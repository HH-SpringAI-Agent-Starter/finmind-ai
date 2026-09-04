/**
 * 数字藏品价值投资 Agent — Decision Flow 第3块 (flow_nft_003)
 *
 * 组合仓位管理与批量扫描层 (Portfolio & Monitoring Layer)
 *
 * 与 flow_nft_002.js 的关系:
 *   - flow_002 = 单问题决策引擎: 用户问一个问题 → 分类 → 路由 → 子决策流
 *   - 本模块  = 组合层调度器: 已有持仓 → 批量扫描 → P0-P2优先级动作清单 → 退出执行计划
 *   - 深度归因复用 flow_002.drawdownAttribution (地板价≤-50% 触发时)
 *
 * 规则来源: knowhow/nft/rules_nft_003.json
 * 覆盖: 单资产10%铁律 / 核心60-成长30-观察10配比护栏 / P0-P2优先级扫描 / 分批退出执行
 */

'use strict';

const { NFTDecisionFlow } = require('./flow_nft_002.js');

// ---- 阈值常量 (对齐 rules_nft_003.json) ----
const SINGLE_ASSET_CAP_PCT = 10;      // 单一系列 ≤10% 铁律
const WATCH_PCT_LIMIT = 15;           // 观察仓 >15% 强制降回
const GROWTH_PCT_LIMIT = 40;          // 成长仓 >40% 强制再平衡
const CORE_PCT_FLOOR = 50;            // 核心仓 <50% 检视(不自动补)
const TOLERANCE = 5;                  // 配比容差
const LIQ_BUFFER_DANGER = 30;         // 距清算线 <30% → P0
const FLOOR_CRASH_PCT = -50;          // 地板价 -50% 触发深度归因
const RETENTION_BROKEN = 70;          // 留存率 <70% 逻辑在坏
const VOLUME_DRY_PCT = -50;           // 成交量腰斩 → 流动性枯竭
const STOP_UPDATE_DAYS = 90;          // 停更90天 → 黄警
const PRICE_GUARD_PCT = 0.08;         // 挂单价 ≥ 地板价×(1-8%)
const VOLUME_GUARD_PCT = 0.10;        // 单笔卖出量 ≤ 日成交量10%

class NFTPortfolioManager {
  /**
   * 1. 单资产仓位检查 — 10% 铁律落地
   * rules_nft_003: single_asset_pct > 10 → P1 强制减仓
   */
  checkSingleAssetCap({ asset, pct, portfolio_value = null } = {}) {
    if (pct > SINGLE_ASSET_CAP_PCT) {
      const excess_pct = pct - SINGLE_ASSET_CAP_PCT;
      const excess_value = portfolio_value !== null ? portfolio_value * (excess_pct / 100) : null;
      return {
        asset, pct, cap: SINGLE_ASSET_CAP_PCT,
        over: true, excess_pct,
        excess_value: excess_value !== null ? Math.round(excess_value) : null,
        priority: 'P1',
        decision: '🔴 强制减仓',
        reason: `单系列 ${pct}% > ${SINGLE_ASSET_CAP_PCT}% 铁律(rules_001铁律#2)，超配 ${excess_pct}%`,
        action: `分批减仓至≤${SINGLE_ASSET_CAP_PCT}%，禁止一次性市价砸穿地板(走 buildExitPlan P1 节奏)`
      };
    }
    return {
      asset, pct, cap: SINGLE_ASSET_CAP_PCT,
      over: false, excess_pct: 0,
      priority: null, decision: '✅ 合规', reason: `单系列 ${pct}% ≤ ${SINGLE_ASSET_CAP_PCT}% 铁律内`
    };
  }

  /**
   * 2. 组合配比检查 — 核心60/成长30/观察10 护栏
   * rules_nft_003: watch>15→P1强制降回; growth>40→P1再平衡; core<50→P2检视
   */
  checkAllocation({ core_pct, growth_pct, watch_pct } = {}) {
    const issues = [];
    let highest = null;
    const push = (priority, label, msg) => {
      issues.push({ priority, label, msg });
      if (!highest || priority < highest) highest = priority;
    };

    if (watch_pct > WATCH_PCT_LIMIT) {
      push('P1', '观察仓超限',
        `观察仓 ${watch_pct}% > ${WATCH_PCT_LIMIT}%：观察仓悄悄加码=失败案例A仓位失控的前兆，强制降回10%`);
    }
    if (growth_pct > GROWTH_PCT_LIMIT) {
      push('P1', '成长仓超配',
        `成长仓 ${growth_pct}% > ${GROWTH_PCT_LIMIT}%：高风险敞口超配=重新押注赛道，分批转核心仓或现金`);
    }
    if (core_pct < CORE_PCT_FLOOR) {
      push('P2', '核心仓跌破护栏',
        `核心仓 ${core_pct}% < ${CORE_PCT_FLOOR}%：检视不自动补——补核心=新决策，必须重新走完整买入流`);
    }
    if (Math.abs(core_pct - 60) <= TOLERANCE && Math.abs(growth_pct - 30) <= TOLERANCE && Math.abs(watch_pct - 10) <= TOLERANCE) {
      return {
        core_pct, growth_pct, watch_pct,
        compliant: true, priority: null,
        decision: '✅ 配比合规', issues: [],
        reason: `核心${core_pct}/成长${growth_pct}/观察${watch_pct} 均在容差±${TOLERANCE}内`
      };
    }
    return {
      core_pct, growth_pct, watch_pct,
      compliant: false, priority: highest,
      decision: highest === 'P1' ? '🔴 强制再平衡' : '🟡 检视',
      issues,
      reason: issues.map(i => i.msg).join('；')
    };
  }

  /**
   * 3. 单持仓扫描 — 一条持仓跑完所有 P0/P1/P2 信号
   * rules_nft_003.scan_rules.per_holding_signals
   */
  scanHolding(h = {}) {
    const {
      name = '未命名', custody = 'self', shutdown_announced = false, shutdown_rumor = false,
      is_loan = false, liq_buffer = null, floor_change_pct = 0, retention_pct = null,
      volume_change_pct = null, stop_update_days = 0, team_active = true,
      month_sell = 0, month_buy = 0
    } = h;

    const signals = [];
    const push = (priority, key, label, action, detail) => signals.push({ priority, key, label, action, detail });

    // ---- P0 信号: 通道消失 / 清算螺旋 ----
    if (custody === 'platform' && shutdown_announced) {
      push('P0', 'platform_shutdown', '平台关停(通道消失)', '尽快提现/卖出，不分散批次',
        '失败案例D：平台托管+已公告清退=价格归零倒计时，唯一动作是卖得掉，不追求卖价');
    }
    if (is_loan && liq_buffer !== null && liq_buffer < LIQ_BUFFER_DANGER) {
      push('P0', 'liquidation_spiral', '清算螺旋高危', '立即还贷/补保证金，不等强平',
        `距清算线仅 ${liq_buffer}% < ${LIQ_BUFFER_DANGER}%：一次波动即触发强平，主动降杠杆=自己定价`);
    }

    // ---- P1 信号: 逻辑恶化 / 流动性枯竭 / 渠道疑云 ----
    if (custody === 'platform' && !shutdown_announced && shutdown_rumor) {
      push('P1', 'shutdown_rumor', '平台关停传闻', '先降仓位，绝不再入场',
        '未公告但雷声四起：先降仓位，不赌公告内容');
    }
    if (floor_change_pct <= FLOOR_CRASH_PCT) {
      // 复用 flow_002 深度归因: 字段名对齐其签名(drawdown_pct/days_since_update/retention_rate/...)
      const dd = new NFTDecisionFlow().drawdownAttribution({
        drawdown_pct: floor_change_pct,
        days_since_update: stop_update_days,
        retention_rate: retention_pct ?? 100,
        volume_change_pct: volume_change_pct ?? 0,
        monthly_buy_vs_sell: month_sell > month_buy ? 'sell_gt_buy' : (month_buy > month_sell ? 'buy_gt_sell' : 'unknown'),
        team_status: team_active ? 'active' : 'vanished'
      });
      const fatal = dd.decision.includes('淘汰');
      push('P1', 'floor_crash', '地板价暴跌', fatal ? '深度归因→逻辑失效→分批淘汰' : '深度归因→逻辑健康→持有观察',
        `地板价 ${floor_change_pct}% ≤ ${FLOOR_CRASH_PCT}%：${dd.reason}`);
    }
    if (retention_pct !== null && retention_pct < RETENTION_BROKEN) {
      push('P1', 'retention_broken', '留存率崩塌', '逻辑在坏：需求消退，进入观察并准备退出',
        `留存率 ${retention_pct}% < ${RETENTION_BROKEN}%：持有人留不住=需求消失前兆`);
    }
    if (volume_change_pct !== null && volume_change_pct <= VOLUME_DRY_PCT) {
      push('P1', 'liquidity_dry', '流动性枯竭', '退出窗口收窄，尽早分批走',
        `成交量 ${volume_change_pct}%：腰斩=蓝筹半山腰陷阱前兆(失败案例B)，越晚越卖不掉`);
    }
    if (!team_active) {
      push('P1', 'team_inactive', '运营失效', '团队隐身/裁员=项目死亡前兆，进入退出预案',
        '失败案例A：团队消失后一切信号都是噪音');
    }

    // ---- P2 信号: 观察级 ----
    if (stop_update_days >= STOP_UPDATE_DAYS) {
      push('P2', 'stop_update', '停更黄警', '进入观察，设30天复查',
        `已停更 ${stop_update_days} 天 ≥ ${STOP_UPDATE_DAYS} 天(rules_001铁律#3)`);
    }
    if (month_sell > month_buy) {
      push('P2', 'mutual_cut', '存量互割', '新资金不进，价格靠互割维持，观察',
        `月卖出 ${month_sell} > 月买入 ${month_buy}：存量互割=需求枯竭早期信号`);
    }
    if (retention_pct === null || volume_change_pct === null) {
      push('P2', 'data_missing', '关键数据缺失', '按保守处理：视为黄警，禁止因无数据默认健康',
        '缺留存率/成交量数据：宁可误报不可漏报');
    }

    // ---- 优先级裁决: P0 > P1 > P2 ----
    if (signals.length === 0) {
      return { name, priority: null, decision: '✅ 持有', signals: [], action: '无动作，进入每周例行扫描', next_review_days: 7 };
    }
    signals.sort((a, b) => a.priority.localeCompare(b.priority));
    const top = signals[0];
    const p0 = signals.filter(s => s.priority === 'P0');
    const p1 = signals.filter(s => s.priority === 'P1');
    const decision = p0.length
      ? '🚨 P0 立即行动'
      : p1.length ? '🔴 P1 限期处理' : '🟡 P2 观察';
    return {
      name, priority: top.priority, decision, signals,
      action: top.action,
      reason: signals.map(s => `[${s.priority}]${s.label}: ${s.detail}`).join('；'),
      next_review_days: top.priority === 'P0' ? 1 : top.priority === 'P1' ? 7 : 30
    };
  }

  /**
   * 4. 批量扫描 — 全组合跑一遍，按优先级排序输出动作清单
   */
  scanPortfolio(holdings = []) {
    const items = holdings.map(h => this.scanHolding(h));
    const order = { P0: 0, P1: 1, P2: 2 };
    items.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
    const counts = { P0: items.filter(i => i.priority === 'P0').length, P1: items.filter(i => i.priority === 'P1').length, P2: items.filter(i => i.priority === 'P2').length, hold: items.filter(i => !i.priority).length };
    return { items, counts, summary: `共 ${items.length} 笔持仓：P0×${counts.P0} / P1×${counts.P1} / P2×${counts.P2} / 持有×${counts.hold}` };
  }

  /**
   * 5. 退出执行计划 — 分批节奏 + 价格/量护栏
   * rules_nft_003.exit_execution
   */
  buildExitPlan({ priority = 'P1', reason = '', floor_price = null, daily_volume = null, position_value = null } = {}) {
    if (priority === 'P0' && reason.includes('平台关停')) {
      return {
        priority: 'P0', reason, batches: [{ step: 1, pct: 100, deadline: '立即', method: '提现/卖出(通道消失，不分批)' }],
        guards: ['价格归零倒计时：只追求卖得掉，不追求卖价'],
        note: '失败案例D：平台托管+公告清退后场外 90%+ 崩盘，拖=归零'
      };
    }
    if (priority === 'P0' && reason.includes('清算')) {
      return {
        priority: 'P0', reason, batches: [{ step: 1, pct: 100, deadline: '立即', method: '还贷/补保证金降杠杆(主动定价，不等强平)' }],
        guards: [`距清算线 <${LIQ_BUFFER_DANGER}%：一次波动即触发，行动优先于价格`],
        note: '失败案例F：强平=被市场定价，主动降杠杆=自己定价'
      };
    }
    if (priority === 'P1') {
      const batches = [
        { step: 1, pct: 50, deadline: '立即', method: '卖出50%' },
        { step: 2, pct: 30, deadline: '7天内', method: '卖出30%' },
        { step: 3, pct: 20, deadline: '14天内', method: '卖出20%' }
      ];
      const guards = [];
      if (floor_price !== null) {
        guards.push(`挂单价 ≥ ${floor_price}×(1-${PRICE_GUARD_PCT * 100}%)，禁止市价单砸穿`);
      }
      if (daily_volume !== null && position_value !== null) {
        const per_batch_min = Math.ceil(position_value * 0.5 / (daily_volume * VOLUME_GUARD_PCT));
        guards.push(`单笔卖出量 ≤ 日成交量${VOLUME_GUARD_PCT * 100}%，按此估算首批需拆 ${per_batch_min} 笔`);
      }
      guards.push('禁止"等反弹再卖"：深度回调策略胜率<15%，等反弹=重复失败案例B');
      return { priority: 'P1', reason, batches, guards, note: '分批≠择时，分批=降低自我踩踏的流动性冲击' };
    }
    if (priority === 'P2') {
      return { priority: 'P2', reason, batches: [], guards: ['不动作'], note: '设30天复查，触发P1信号再升级', next_review_days: 30 };
    }
    return { priority: 'UNKNOWN', reason, batches: [], guards: [], note: '需要人工确认，禁止默认放行(例外SPA点)' };
  }

  /**
   * 6. 组合层总入口: 配比检查 + 批量扫描 + 重点退出计划
   */
  run({ holdings = [], allocation = {}, exit_focus = null } = {}) {
    const alloc = this.checkAllocation(allocation);
    const scans = this.scanPortfolio(holdings);
    let exits = null;
    if (exit_focus) exits = this.buildExitPlan(exit_focus);
    return { allocation: alloc, scans, exits };
  }
}

module.exports = { NFTPortfolioManager, run: (input) => new NFTPortfolioManager().run(input) };