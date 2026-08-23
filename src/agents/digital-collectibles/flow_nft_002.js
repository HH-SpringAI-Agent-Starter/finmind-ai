/**
 * 数字藏品价值投资 Agent — Decision Flow 第2块 (flow_nft_002)
 *
 * 把 kh_nft_decision_001.md(专家三段推理链) + kh_nft_failure_002.md
 * (平台关停D / 一级MINT破发E / 抵押清算螺旋F) 变成可执行决策流。
 *
 * 与 nft_agent_server.js 的关系:
 *   - server 是 MCP SSE 协议外壳(第1块代码: evaluate/check/risk/judge/track 5工具)
 *   - 本模块是第2块代码: 综合决策路由层(问题分类→子流执行→例外处理)
 *   - 通过 server 挂载的 decision_flow 工具对外提供 MCP 调用
 *
 * 规则来源: knowhow/nft/rules_nft_002.json
 */

'use strict';

// ---- 阈值常量 (对齐 rules_nft_002.json / kh_* 砖) ----
const SURVIVAL_THRESHOLD = 2;          // 生存证据≥2项才进评分
const MINT_RATIO_LIMIT = 2;            // 发行价>同赛道地板×2 → 不参与MINT
const LIQ_BUFFER_DANGER = 30;          // 距清算线<30% → 极高危(一次波动触发)
const LIQ_BUFFER_SAFE = 50;            // >50% 才勉强可评估
const MAX_LTV_LIQUIDITY = 50;          // 周转用途抵押率上限%
const DRAWDOWN_TRIGGER_PCT = -50;      // 地板价-50%触发深度分析
const STOP_UPDATE_DAYS = 90;           // 停更90天触发黄警
const RETENTION_OK = 70;               // 留存率健康线%
const POSITION_CAP_PCT = 10;           // 单一系列≤10%铁律

class NFTDecisionFlow {
  /**
   * 第0步: 问题分类 → 决定走哪条子路径
   * 对应 kh_nft_decision_001 第0步: 先分类问题，再路由
   */
  classifyQuestion(type) {
    const map = {
      buy:        { route: 'buy',       label: '买入决策流',     desc: '新项目/加仓' },
      hold:       { route: 'hold',      label: '持有/卖出决策流', desc: '已持仓的持有与卖出' },
      drawdown:   { route: 'drawdown',  label: '回撤归因流',     desc: '地板价下跌/停更处理' },
      today_pick: { route: 'reject',    label: '❌ 直接拒绝',    desc: 'V6.0铁律: 禁止"今天买什么"类问题' },
      platform:   { route: 'platform',  label: '平台关停流',     desc: '通道风险分诊(失败案例D)' },
      mint:       { route: 'mint',      label: '一级MINT流',     desc: '首发/铸造抢购(失败案例E)' },
      loan:       { route: 'loan',      label: '抵押清算流',     desc: 'NFT借贷/加杠杆(失败案例F)' }
    };
    const hit = map[type];
    if (!hit) {
      return { route: 'unknown', label: '⚠️ 需人工确认', desc: '问题类型无法判定，禁止默认放行(例外SPA点)' };
    }
    return { ...hit, question_type: type };
  }

  /**
   * 买入第1关: 生存证据
   * kh_nft_decision_001 第2步判断A: 先算"生存证据"，不是算"涨多高"
   */
  evaluateSurvival({ survived_cycle = false, commercialization_ge_3 = false, team_active = false, retention_ge_70 = false } = {}) {
    const checks = { survived_cycle, commercialization_ge_3, team_active, retention_ge_70 };
    const passed = Object.entries(checks).filter(([, v]) => v).map(([k]) => k);
    const n = passed.length;
    if (n < SURVIVAL_THRESHOLD) {
      return {
        passed_count: n, threshold: SURVIVAL_THRESHOLD, passed,
        decision: '❌ 拒买',
        reason: `生存证据仅${n}/4项(<${SURVIVAL_THRESHOLD})：可能只是"看起来蓝筹"的接盘陷阱，不进入评分体系`
      };
    }
    return {
      passed_count: n, threshold: SURVIVAL_THRESHOLD, passed,
      decision: '✅ 通过',
      reason: `生存证据${n}/4项达标 → 进入评分体系(rules_nft_001: 稀缺30/合规25/流动性25/长期共识20)`
    };
  }

  /**
   * 失败案例D: 平台关停(通道风险)
   * iBox/幻核归零路径: 平台即交易所, 交易场所消失=流动性归零=价格归零
   */
  checkPlatformShutdown({ custody = 'platform', buyback_commitment = false, shutdown_announced = false, shutdown_rumor = false } = {}) {
    if (custody === 'self') {
      return {
        risk: '中', decision: '🟡 中风险',
        reason: '自持私钥：平台关停只是失去"交易入口"，链上资产还在(真链上所有权)',
        actions: ['确认私钥自持且已备份', '寻找公开链/真实二级市场迁移通道'],
        ref: 'kh_nft_failure_002.md 案例D'
      };
    }
    const actions = [];
    if (buyback_commitment) {
      actions.push('按回购/抵兑承诺走退款，但设"平台可能赖账"的最坏预期');
    } else {
      actions.push('无任何书面对价承诺 → 剩余资产直接按归零处理，禁止抄底补仓');
    }
    if (shutdown_announced) {
      actions.push('已公告清退 → 唯一动作=尽快提出可提现资产，剩余按0计');
    }
    if (!shutdown_announced && shutdown_rumor) {
      actions.push('未公告但暴雷传闻 → 先降低仓位，绝不入场');
    }
    return {
      risk: '高', decision: '🔴 高风险',
      reason: '平台托管：平台即交易所，平台关停=流动性归零=价格归零，与项目基本面无关(通道风险，failure_001判不了)',
      actions: actions.length ? actions : ['无明确信号，持续监控平台公告'],
      ref: 'kh_nft_failure_002.md 案例D'
    };
  }

  /**
   * 失败案例E: 一级MINT破发
   * 抢购≠赚钱: 发行价往往对标"上一个爆款"定高价, 破发后"等反弹"是无量阴跌陷阱
   */
  checkMint({ mint_price_vs_floor = 1, open_above_mint = false } = {}) {
    // 抢购前: 发行价 vs 同赛道地板
    if (mint_price_vs_floor > MINT_RATIO_LIMIT) {
      return {
        decision: '❌ 不参与白名单',
        reason: `发行价=同赛道地板×${mint_price_vs_floor}(>×${MINT_RATIO_LIMIT})，发行价透支预期，大概率破发`,
        action: '放弃MINT；铁律：MINT前没算清发行价vs地板，就禁止参与白名单',
        ref: 'kh_nft_failure_002.md 案例E'
      };
    }
    // 抢到后: 开盘定生死, 不"等反弹"
    if (!open_above_mint) {
      return {
        decision: '🔴 立即止损',
        reason: '开盘价≤发行价(破发)：NFT无量阴跌，回到发行价概率极低(流动性差)',
        action: '立即挂单止损，不幻想"等反弹"——反弹心理=案例E典型亏损路径',
        ref: 'kh_nft_failure_002.md 案例E'
      };
    }
    return {
      decision: '🟢 可持有/套利候选',
      reason: '开盘价>发行价(溢价)且发行价未透支(≤地板×2)，才有参与价值',
      action: '进入【买入决策流】完整评估(生存证据+评分)，不因溢价直接追入',
      ref: 'kh_nft_failure_002.md 案例E'
    };
  }

  /**
   * 失败案例F: NFT抵押清算螺旋 (BendDAO 模式)
   * 杠杆把"价格下跌"变成"强平抛压+击穿清算线"的自我强化; 慢死变速死
   */
  checkLoanClearing({ distance_to_liquidation_pct = 100, loan_purpose = 'add_position', ltv_pct = 0, liquid_market = false } = {}) {
    if (loan_purpose === 'add_position') {
      return {
        risk: '极高', decision: '❌ 拒绝',
        reason: '借款用途=补仓/加码：用杠杆放大泡沫=死亡螺旋燃料',
        action: '先讲清算螺旋(BendDAO 2022连环清算)，不急着算收益；铁律：NFT抵押借贷除非有真实现金流，全线拒绝',
        ref: 'kh_nft_failure_002.md 案例F'
      };
    }
    // 周转用途
    if (distance_to_liquidation_pct < LIQ_BUFFER_DANGER) {
      return {
        risk: '极高', decision: '🚨 极高危',
        reason: `距清算线仅${distance_to_liquidation_pct}%(<${LIQ_BUFFER_DANGER}%)：一次波动即触发强平`,
        action: '拒绝或立即补保证金/降杠杆；NFT流动性极差，清算拍卖无人接盘，拍卖价远低于真实地板',
        ref: 'kh_nft_failure_002.md 案例F'
      };
    }
    if (ltv_pct >= MAX_LTV_LIQUIDITY) {
      return {
        risk: '高', decision: '❌ 拒绝',
        reason: `抵押率${ltv_pct}%≥${MAX_LTV_LIQUIDITY}%上限：周转用途也须极低杠杆`,
        action: '降杠杆至<50%或放弃；杠杆把慢跌变速死(普通持有者亏50%可拿，抵押者亏30%已被强平归零)',
        ref: 'kh_nft_failure_002.md 案例F'
      };
    }
    if (distance_to_liquidation_pct > LIQ_BUFFER_SAFE && liquid_market) {
      return {
        risk: '中', decision: '🟡 勉强可评估',
        reason: `距清算线${distance_to_liquidation_pct}%(>${LIQ_BUFFER_SAFE}%)且流动性充裕，用途=短期周转`,
        action: '仅限极低杠杆(抵押率<50%)+明确还款来源；持续监控地板价与清算线距离',
        ref: 'kh_nft_failure_002.md 案例F'
      };
    }
    return {
      risk: '高', decision: '🔴 高危',
      reason: `距清算线${distance_to_liquidation_pct}%、流动性${liquid_market ? '充裕' : '匮乏'}，未达安全评估条件`,
      action: '降杠杆或拒绝；不要用"蓝筹不会跌"的假设为清算风险买单',
      ref: 'kh_nft_failure_002.md 案例F'
    };
  }

  /**
   * 持有/回撤: 打折 vs 逻辑失效 (专家与散户的分水岭)
   * kh_nft_decision_001 第3步判断1: 先归因，不自动卖
   */
  drawdownAttribution({ drawdown_pct = 0, days_since_update = 0, retention_rate = 100, volume_change_pct = 0, monthly_buy_vs_sell = 'unknown', team_status = 'active', user_growth_source = 'unknown' } = {}) {
    const triggered = drawdown_pct <= DRAWDOWN_TRIGGER_PCT || days_since_update >= STOP_UPDATE_DAYS;

    const bad = [];
    if (retention_rate < RETENTION_OK) bad.push(`持有人留存率${retention_rate}%<${RETENTION_OK}% → 逻辑在坏`);
    if (volume_change_pct <= -50) bad.push(`成交量腰斩${volume_change_pct}% → 流动性枯竭(蓝筹半山腰陷阱)`);
    if (monthly_buy_vs_sell === 'sell_gt_buy') bad.push('月卖出>买入 → 存量互割');
    if (team_status === 'vanished' || team_status === 'layoff') bad.push(`团队${team_status === 'vanished' ? '跑路' : '裁员'} → 运营失效`);
    if (user_growth_source === 'speculator') bad.push('用户增长来自投机者 → 死亡螺旋前兆');

    if (!triggered) {
      return {
        trigger: false, decision: '🟢 正常监控',
        reason: `未触发深度分析线(回撤${drawdown_pct}%, 停更${days_since_update}天)`,
        bad_signals: bad
      };
    }
    if (bad.length === 0) {
      return {
        trigger: true, decision: '🟡 持有观察',
        reason: '触发深度分析但核心逻辑未坏：下跌是市场beta不是逻辑失效，不因跌50%恐慌，不自动卖出',
        bad_signals: bad
      };
    }
    return {
      trigger: true, decision: '🔴 逻辑失效→淘汰',
      reason: `触发深度分析且${bad.length}项逻辑信号恶化: ${bad.join('; ')}`,
      bad_signals: bad,
      action: '看逻辑不看短期涨跌，逐步退出；禁止"越低越买"倒金字塔补仓'
    };
  }

  /**
   * 加仓审批: 没有快捷通道, 走完整买入流
   * kh_nft_decision_001 第3步判断3
   */
  approveAddPosition({ logic_ok = true, position_pct = 0, survival = {} } = {}) {
    if (!logic_ok) {
      return { decision: '❌ 禁止加仓', reason: '核心逻辑已失效：越低越买=倒金字塔补仓(失败案例A的病根)，拒绝摊平' };
    }
    if (position_pct >= POSITION_CAP_PCT) {
      return { decision: '❌ 先再平衡', reason: `该资产已占组合${position_pct}%≥${POSITION_CAP_PCT}%铁律，先强制再平衡再谈加仓` };
    }
    const s = this.evaluateSurvival(survival);
    if (s.decision.includes('拒买')) {
      return { decision: '❌ 拒绝加仓', reason: `生存证据不足: ${s.reason}` };
    }
    return {
      decision: '🟡 走完整买入流',
      reason: '加仓=重新评估，无快捷通道(不因"摊低成本"开绿灯)',
      survival: s,
      action: '按 rules_nft_001 评分体系+仓位约束重新走一遍买入决策流后，再决定是否允许'
    };
  }

  /**
   * 总入口: 问题分类 → 路由 → 各子决策流
   * 统一输出: triage(分诊结果) + decision + reason + actions/ref
   */
  resolve(input = {}) {
    const { question_type, ...rest } = input;
    const cls = this.classifyQuestion(question_type);
    const base = { question_type, triage: cls.label };

    switch (cls.route) {
      case 'reject':
        return {
          ...base, decision: '❌ 拒绝回答',
          reason: 'V6.0铁律：彻底去除短线/打板/热点追涨/社区情绪炒作，"今天买什么"类问题一律不答',
          actions: ['引导用户描述具体项目的具体情况，再走对应决策流']
        };
      case 'platform':
        return { ...base, decision: '🔴 通道风险分诊', ...this.checkPlatformShutdown(rest) };
      case 'mint':
        return { ...base, decision: '一级MINT分诊', ...this.checkMint(rest) };
      case 'loan':
        return { ...base, decision: '杠杆风险分诊', ...this.checkLoanClearing(rest) };
      case 'buy': {
        const s = this.evaluateSurvival(rest.survival || rest);
        if (s.decision.includes('拒买')) {
          return { ...base, decision: s.decision, reason: s.reason };
        }
        return {
          ...base, decision: '🟡 进入评分体系',
          reason: s.reason,
          action: '请补充稀缺/合规/流动性/共识四项评分输入，交由 evaluate_project 评分器(rules_nft_001)'
        };
      }
      case 'drawdown':
      case 'hold':
        return { ...base, decision: '回撤归因', ...this.drawdownAttribution(rest) };
      case 'unknown':
      default:
        return {
          ...base, decision: '⚠️ 需人工确认',
          reason: '问题类型无法判定，不默认放行(例外SPA点：证据不足→保守桶等待更多证据)'
        };
    }
  }
}

module.exports = { NFTDecisionFlow, resolve: (input) => new NFTDecisionFlow().resolve(input) };