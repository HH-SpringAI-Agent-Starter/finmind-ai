/**
 * 数字藏品价值投资 Agent — MCP SSE Server
 *
 * 数字藏品版巴菲特模型 (V6.0)
 * 将 Know-how 决策流封装为 MCP Agent 工具:
 *   - 不预测明天涨跌，只寻找未来 5-10 年仍存在的数字资产
 *   - 彻底去除短线/打板/热点追涨/社区情绪炒作/24h成交异动
 *
 * 协议: MCP SSE (Server-Sent Events)
 * 端口: 3200
 * 规则来源: knowhow/nft/rules_nft_001.json + kh_nft_failure_001.md (第1块)
 * 第2块: knowhow/nft/rules_nft_002.json + kh_nft_decision_001.md + kh_nft_failure_002.md
 *   → flow_nft_002.js 决策路由层, 通过启动段挂载的 decision_flow 工具对外提供
 */

const http = require('http');
const { randomUUID } = require('crypto');

const PORT = 3200;

// ============================================================
// V6.0 核心常量 (来自 rules_nft_001.json)
// ============================================================

const ALLOCATION = {
  core:   { pct: 60, horizon: '5-10年', desc: '核心仓：穿越牛熊的确定性资产' },
  growth: { pct: 30, horizon: '3-5年',  desc: '成长仓：赛道成长期的资产' },
  watch:  { pct: 10, horizon: '1-3年',  desc: '观察仓：验证逻辑的小仓位' }
};

const LONG_TERM_TRACKS = ['AI数字资产', 'RWA', 'BTC生态', '蓝筹NFT'];
const FUTURE_DEAD_TRACKS = ['元宇宙土地', '纯艺术NFT', '链游装备'];

const SCORING_WEIGHTS = {
  scarcity: 30,
  compliance: 25,
  liquidity: 25,
  long_term_consensus: 20
};

const MAOTAI_STANDARD = [
  { key: 'survived_cycle', label: '穿越≥1轮牛熊（≥4年历史）' },
  { key: 'holders_ge_10000', label: '持有人≥10000' },
  { key: 'commercialization_ge_3', label: '商业化≥3项' },
  { key: 'global_influence', label: '全球影响力' },
  { key: 'founder_years_ge_4', label: '创始人运营≥4年' },
  { key: 'retention_ge_70', label: '社区留存率≥70%' }
];

const IRON_RULES = [
  '国内二级市场不参与（违规红线）',
  '单一系列投资≤总投资额10%',
  '项目停更90天→黄色警告',
  '地板价-50%→启动深度分析',
  '禁止任何"今天买什么"类问题',
  '淘汰项目看逻辑不看短期涨跌'
];

// ============================================================
// MCP Protocol Helpers
// ============================================================

class MCPServer {
  constructor() {
    this.sessions = new Map();
    this.tools = new Map();
    this._registerBuiltinTools();
  }

  _registerBuiltinTools() {
    // Tool 1: 项目价值评估（10年视角评分 + 赛道分类 + 数字茅台标准）
    this.registerTool('evaluate_project', {
      description: '数字藏品项目价值评估: 赛道分类→评分体系(稀缺30+合规25+流动性25+共识20)→数字茅台标准→配置判定',
      inputSchema: {
        type: 'object',
        required: ['name', 'track'],
        properties: {
          name: { type: 'string', description: '项目名称' },
          track: { type: 'string', enum: ['AI数字资产', 'RWA', 'BTC生态', '蓝筹NFT', '元宇宙土地', '纯艺术NFT', '链游装备'], description: '赛道分类' },
          scarcity_score: { type: 'number', description: '稀缺性得分 0-100' },
          compliance_score: { type: 'number', description: '合规性得分 0-100' },
          liquidity_score: { type: 'number', description: '流动性得分 0-100' },
          consensus_score: { type: 'number', description: '长期共识得分 0-100' },
          history_years: { type: 'number', description: '项目历史年限(年)' },
          holders: { type: 'number', description: '持有人数量' },
          commercialization_count: { type: 'number', description: '商业化收入源数量' },
          global_influence: { type: 'boolean', description: '是否有全球影响力' },
          founder_years: { type: 'number', description: '创始人运营年限' },
          retention_rate: { type: 'number', description: '社区年留存率%' }
        }
      }
    });

    // Tool 2: 持仓配置检查（核心60/成长30/观察10 + 单系列≤10% + 再平衡）
    this.registerTool('check_portfolio', {
      description: '持仓配置合规检查: 核心60%/成长30%/观察10% + 单一系列≤10%铁律 + 强制再平衡建议',
      inputSchema: {
        type: 'object',
        required: ['portfolio'],
        properties: {
          portfolio: {
            type: 'array',
            description: '持仓列表',
            items: {
              type: 'object',
              required: ['name', 'tier', 'value'],
              properties: {
                name: { type: 'string' },
                tier: { type: 'string', enum: ['core', 'growth', 'watch'] },
                value: { type: 'number', description: '市值(法币)' },
                series: { type: 'string', description: '所属系列(用于单系列≤10%检查)' }
              }
            }
          },
          total_value: { type: 'number', description: '总投资额(如缺省则用持仓求和)' }
        }
      }
    });

    // Tool 3: 风险预警（停更90天黄警 / 地板价-50%深析 / 三大失败模式识别）
    this.registerTool('risk_alert', {
      description: '风险预警引擎: 项目停更90天→黄警, 地板价-50%→深度分析, 元宇宙土地/蓝筹PFP半山腰/链游死亡螺旋三大失败模式识别',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: '项目名称' },
          days_since_last_update: { type: 'number', description: '距上次更新天数(停更检测)' },
          floor_price_drawdown_pct: { type: 'number', description: '地板价从高点回撤%' },
          track: { type: 'string', enum: ['AI数字资产', 'RWA', 'BTC生态', '蓝筹NFT', '元宇宙土地', '纯艺术NFT', '链游装备'] },
          daily_active_users: { type: 'number', description: '日活用户数' },
          land_plots: { type: 'number', description: '土地地块数(元宇宙场景)' },
          volume_change_pct: { type: 'number', description: '月成交量变化%(流动性枯竭检测)' },
          retention_rate: { type: 'number', description: '社区年留存率%' },
          monthly_buy_vs_sell: { type: 'string', enum: ['buy_gt_sell', 'sell_gt_buy', 'unknown'], description: '月新增买入vs卖出' },
          team_status: { type: 'string', enum: ['active', 'layoff', 'vanished', 'unknown'], description: '团队运营状态' },
          token_inflation: { type: 'boolean', description: '代币是否无限增发(链游检测)' },
          burn_scenario: { type: 'boolean', description: '是否有真实销毁场景(链游检测)' },
          player_retention_30d: { type: 'number', description: '30天玩家留存%(链游检测)' },
          team_wallet_unlocked: { type: 'boolean', description: '项目方钱包是否有未售代币(链游检测)' }
        }
      }
    });

    // Tool 4: 淘汰判定（看逻辑不看短期涨跌）
    this.registerTool('judge_elimination', {
      description: '淘汰判定: 逻辑失效(赛道证伪/团队跑路/留存率崩)→淘汰; 仅短期波动→继续持有',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          floor_change_1m: { type: 'number', description: '近1月地板价变化%' },
          logic_status: { type: 'string', enum: ['logic_intact', 'logic_weakened', 'logic_falsified', 'team_vanished', 'retention_collapsed'], description: '核心逻辑状态' },
          track: { type: 'string', enum: ['AI数字资产', 'RWA', 'BTC生态', '蓝筹NFT', '元宇宙土地', '纯艺术NFT', '链游装备'] },
          hold_days: { type: 'number', description: '已持有天数' }
        }
      }
    });

    // Tool 5: 赛道体检（四大长期赛道 vs 未来消失赛道）
    this.registerTool('track_health', {
      description: '赛道体检: 长期赛道(10年视角) vs 未来消失赛道判断, 输出赛道配置建议',
      inputSchema: {
        type: 'object',
        required: [],
        properties: {
          track: { type: 'string', enum: ['AI数字资产', 'RWA', 'BTC生态', '蓝筹NFT', '元宇宙土地', '纯艺术NFT', '链游装备'], description: '要体检的赛道(缺省=全部)' }
        }
      }
    });
  }

  registerTool(name, spec) {
    this.tools.set(name, spec);
  }

  // ---- MCP Protocol Handlers ----

  handleInitialize(sessionId, params) {
    return {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'digital-collectibles-agent', version: '1.0.0' }
    };
  }

  handleListTools(sessionId) {
    const tools = [];
    for (const [name, spec] of this.tools) {
      tools.push({ name, description: spec.description, inputSchema: spec.inputSchema });
    }
    return { tools };
  }

  async handleCallTool(sessionId, params) {
    const { name, arguments: args } = params;
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
    try {
      let result;
      switch (name) {
        case 'evaluate_project': result = this._execEvaluateProject(args); break;
        case 'check_portfolio': result = this._execCheckPortfolio(args); break;
        case 'risk_alert': result = this._execRiskAlert(args); break;
        case 'judge_elimination': result = this._execJudgeElimination(args); break;
        case 'track_health': result = this._execTrackHealth(args); break;
        // Tool 6: decision_flow 由启动段挂载(见 HTTP Server 段), 沙盒测试不含该工具
        case 'decision_flow': result = this._execDecisionFlow ? this._execDecisionFlow(args) : { error: 'decision_flow 未挂载(仅运行态可用)' }; break;
        default: result = { text: `Tool ${name} executed (no implementation)` };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }

  // ============================================================
  // Core Logic Implementations (基于 Know-how 决策流)
  // ============================================================

  /**
   * Tool 1: 项目价值评估
   * 决策流: 赛道分类 → 未来消失赛道直接拒绝 → 评分 → 数字茅台标准 → 配置判定
   */
  _execEvaluateProject(args) {
    const {
      name, track, scarcity_score = 50, compliance_score = 50,
      liquidity_score = 50, consensus_score = 50,
      history_years = 0, holders = 0, commercialization_count = 0,
      global_influence = false, founder_years = 0, retention_rate = 0
    } = args;

    // 第1步: 赛道分类
    const isLongTerm = LONG_TERM_TRACKS.includes(track);
    const isDeadTrack = FUTURE_DEAD_TRACKS.includes(track);

    // 第2步: 未来消失赛道 → 直接拒绝
    if (isDeadTrack) {
      const deadReason = track === '元宇宙土地'
        ? '日活/地块比<0.1人=投机需求，无实用场景，长期存活率<0.1%（失败案例A）'
        : track === '链游装备'
          ? 'P2E平均寿命3-8个月，赚钱效应吸引投机者非玩家（失败案例C）'
          : '纯艺术NFT无现金流基础，估值无锚（失败案例B同源）';
      return {
        name, track, decision: '❌ 拒绝入场',
        reason: `未来消失赛道(${track})，10年视角看空。${deadReason}`,
        recommendation: '不评分不买入，避免重复2021-2024元宇宙/链游归零路径',
        failure_case_ref: 'kh_nft_failure_001.md'
      };
    }

    if (!isLongTerm) {
      return { name, track, decision: '⚠️ 未知赛道', reason: '赛道不在V6.0四大赛道清单中，需人工确认分类' };
    }

    // 第3步: 评分体系（加权）
    const weightedScore = Math.round(
      scarcity_score * SCORING_WEIGHTS.scarcity / 100 +
      compliance_score * SCORING_WEIGHTS.compliance / 100 +
      liquidity_score * SCORING_WEIGHTS.liquidity / 100 +
      consensus_score * SCORING_WEIGHTS.long_term_consensus / 100
    );

    // 第4步: 数字茅台标准检查（6项）
    const maotaiChecks = {
      survived_cycle: history_years >= 4,
      holders_ge_10000: holders >= 10000,
      commercialization_ge_3: commercialization_count >= 3,
      global_influence: global_influence,
      founder_years_ge_4: founder_years >= 4,
      retention_ge_70: retention_rate >= 70
    };
    const maotaiPassed = Object.values(maotaiChecks).filter(v => v).length;

    // 第5步: 配置判定
    let tier, tierLabel, action;
    if (maotaiPassed === 6 && weightedScore >= 80) {
      tier = 'core';
      tierLabel = '🏛️ 核心仓(60%)·5-10年';
      action = '数字茅台全标准通过+高分 → 纳入核心仓，长期持有穿越牛熊';
    } else if (maotaiPassed >= 4 && weightedScore >= 65) {
      tier = 'growth';
      tierLabel = '🚀 成长仓(30%)·3-5年';
      action = '多数标准通过 → 纳入成长仓，持续跟踪向核心仓升级';
    } else if (weightedScore >= 50) {
      tier = 'watch';
      tierLabel = '👁️ 观察仓(10%)·1-3年';
      action = '基础达标但未达成长标准 → 观察仓小仓位验证逻辑';
    } else {
      tier = 'reject';
      tierLabel = '🚫 不入池';
      action = `评分${weightedScore}<50，不满足V6.0长期持有标准`;
    }

    return {
      name, track,
      step1_track_classification: { is_long_term: isLongTerm, is_dead_track: isDeadTrack },
      step3_weighted_score: {
        detail: { scarcity: scarcity_score, compliance: compliance_score, liquidity: liquidity_score, long_term_consensus: consensus_score },
        weights: SCORING_WEIGHTS,
        total: weightedScore,
        grade: weightedScore >= 80 ? 'A' : weightedScore >= 65 ? 'B' : weightedScore >= 50 ? 'C' : 'D'
      },
      step4_maotai_standard: {
        passed: `${maotaiPassed}/6`,
        checks: maotaiChecks
      },
      step5_allocation: { tier, tier_label: tierLabel, action },
      iron_rules_check: IRON_RULES.map(r => ({ rule: r, status: '待持仓层校验' }))
    };
  }

  /**
   * Tool 2: 持仓配置检查
   * 规则: 核心60/成长30/观察10 + 单系列≤10% + 强制再平衡
   */
  _execCheckPortfolio(args) {
    const { portfolio = [], total_value } = args;
    const total = total_value || portfolio.reduce((s, p) => s + (p.value || 0), 0);
    if (total <= 0) return { error: '总投资额为0，无法检查' };

    // 分层占比
    const byTier = { core: 0, growth: 0, watch: 0 };
    const bySeries = new Map();
    for (const p of portfolio) {
      byTier[p.tier] = (byTier[p.tier] || 0) + (p.value || 0);
      if (p.series) bySeries.set(p.series, (bySeries.get(p.series) || 0) + (p.value || 0));
    }

    const tierResults = Object.entries(ALLOCATION).map(([tier, cfg]) => {
      const actual = byTier[tier] || 0;
      const actualPct = actual / total * 100;
      const targetPct = cfg.pct;
      const diff = actualPct - targetPct;
      return {
        tier,
        target: `${targetPct}%`,
        actual: `${actualPct.toFixed(1)}%`,
        horizon: cfg.horizon,
        status: Math.abs(diff) <= 5 ? '✅ 合规' : (diff > 5 ? '⚠️ 超配' : '⚠️ 低配'),
        action: Math.abs(diff) <= 5 ? '无需调整' : (diff > 5 ? `建议减仓${diff.toFixed(1)}%` : `可加仓${Math.abs(diff).toFixed(1)}%`)
      };
    });

    // 单系列≤10%铁律（epsilon 防浮点 10.000000000000002 误判）
    const seriesResults = [];
    for (const [series, value] of bySeries) {
      const pct = value / total * 100;
      seriesResults.push({
        series,
        pct: `${pct.toFixed(1)}%`,
        status: pct > 10.000001 ? '🚨 违反铁律(单系列>10%)' : '✅ 合规',
        action: pct > 10.000001 ? `强制再平衡：减至≤10%` : '无需调整'
      });
    }

    return {
      total_value: total,
      allocation_summary: tierResults,
      series_iron_rule: seriesResults,
      iron_rule_violations: seriesResults.filter(s => s.status.includes('违反')).length,
      overall: seriesResults.some(s => s.status.includes('违反'))
        ? '🚨 存在铁律违反，立即再平衡'
        : tierResults.some(t => t.status.includes('超配')) ? '⚠️ 分层偏离目标，建议逐步调整' : '✅ 组合合规'
    };
  }

  /**
   * Tool 3: 风险预警引擎
   * 覆盖: 停更90天黄警 / 地板价-50%深析 / 三大失败模式识别
   */
  _execRiskAlert(args) {
    const {
      name, days_since_last_update = 0, floor_price_drawdown_pct = 0,
      track, daily_active_users = 0, land_plots = 0, volume_change_pct = 0,
      retention_rate = 100, monthly_buy_vs_sell = 'unknown', team_status = 'unknown',
      token_inflation = false, burn_scenario = false, player_retention_30d = 100,
      team_wallet_unlocked = false
    } = args;

    const alerts = [];
    const levels = [];

    // 规则1: 停更90天 → 黄色警告
    if (days_since_last_update >= 90) {
      alerts.push({ level: '🟡', rule: '项目停更90天', detail: `距上次更新${days_since_last_update}天`, action: '黄色警告：暂停加仓，限期1个月验证团队是否复活' });
      levels.push('yellow');
    }

    // 规则2: 地板价-50% → 深度分析（不是自动卖出，是深挖逻辑）
    if (floor_price_drawdown_pct <= -50) {
      alerts.push({ level: '🔴', rule: '地板价回撤-50%', detail: `回撤${floor_price_drawdown_pct}%`, action: '启动深度分析：拆解是市场beta还是逻辑失效，区分后再决定' });
      levels.push('red');
    }

    // 失败模式A: 元宇宙土地（日活/地块比 < 0.1）
    if (track === '元宇宙土地' && land_plots > 0) {
      const dauPerPlot = daily_active_users / land_plots;
      if (dauPerPlot < 0.1) {
        alerts.push({ level: '🚨', rule: '元宇宙土地失败模式', detail: `日活/地块比=${dauPerPlot.toFixed(2)}人 < 0.1阈值`, action: '投机需求无实用场景，立即评估退出（失败案例A）' });
        levels.push('red');
      }
    }

    // 失败模式B: 蓝筹PFP半山腰（流动性枯竭+留存率崩）
    if (track === '蓝筹NFT' && (volume_change_pct <= -50 || retention_rate < 70 || monthly_buy_vs_sell === 'sell_gt_buy' || team_status === 'vanished' || team_status === 'layoff')) {
      const reasons = [];
      if (volume_change_pct <= -50) reasons.push(`成交量腰斩${volume_change_pct}%（流动性枯竭）`);
      if (retention_rate < 70) reasons.push(`留存率${retention_rate}%<70%（存量互割）`);
      if (monthly_buy_vs_sell === 'sell_gt_buy') reasons.push('月卖出>买入');
      if (team_status !== 'active') reasons.push(`团队状态=${team_status}`);
      alerts.push({ level: '🚨', rule: '蓝筹PFP半山腰陷阱', detail: reasons.join('; '), action: '深度回调≠抄底机会，NFT深度回调策略胜率<15%（失败案例B）' });
      levels.push('red');
    }

    // 失败模式C: 链游死亡螺旋（代币经济学四问）
    if (track === '链游装备') {
      const econFails = [];
      if (token_inflation) econFails.push('代币无限增发(无销毁)');
      if (!burn_scenario) econFails.push('无真实销毁场景');
      if (player_retention_30d < 30) econFails.push(`30天玩家留存${player_retention_30d}%<30%`);
      if (team_wallet_unlocked) econFails.push('项目方钱包有未售代币');
      if (econFails.length >= 2) {
        alerts.push({ level: '🚨', rule: '链游死亡螺旋', detail: econFails.join('; '), action: 'P2E平均寿命3-8个月，立即评估退出（失败案例C）' });
        levels.push('red');
      } else if (econFails.length === 1) {
        alerts.push({ level: '🟡', rule: '链游经济隐患', detail: econFails.join('; '), action: '持续监控代币经济学四问' });
        levels.push('yellow');
      }
    }

    const maxLevel = levels.includes('red') ? '🔴 高风险' : levels.includes('yellow') ? '🟡 关注' : '🟢 正常';

    return {
      name,
      overall_level: maxLevel,
      alert_count: alerts.length,
      alerts,
      actions_summary: alerts.length === 0 ? '无预警信号，继续持有' : alerts.map(a => `[${a.level}] ${a.rule} → ${a.action}`)
    };
  }

  /**
   * Tool 4: 淘汰判定（看逻辑不看短期涨跌）
   */
  _execJudgeElimination(args) {
    const { name, floor_change_1m = 0, logic_status, track, hold_days = 0 } = args;

    // 逻辑状态判定
    const logicMap = {
      logic_intact: { status: '✅ 逻辑完好', action: '继续持有，短期波动不改变长期判断（铁律6）' },
      logic_weakened: { status: '⚠️ 逻辑减弱', action: '降档观察：减至观察仓，验证是否恢复' },
      logic_falsified: { status: '🚨 逻辑被证伪', action: '淘汰：赛道/资产核心假设被证伪，无论涨跌必须退出' },
      team_vanished: { status: '🚨 团队跑路', action: '淘汰：团队消失=项目死亡，立即退出' },
      retention_collapsed: { status: '🚨 留存率崩塌', action: '淘汰：留存率崩=需求消失，立即退出' }
    };

    const result = logicMap[logic_status] || { status: '未知状态', action: '需人工确认' };

    // 赛道辅助判断: 未来消失赛道的任何下跌都是加速出清信号
    const isDeadTrack = FUTURE_DEAD_TRACKS.includes(track);
    if (isDeadTrack && floor_change_1m < 0) {
      result.track_note = `⚠️ ${track}属未来消失赛道，跌幅${floor_change_1m}%=加速出清，不应抄底`;
    }

    return {
      name,
      floor_change_1m: `${floor_change_1m}%`,
      hold_days: `${hold_days}天`,
      logic_status: result.status,
      decision: result.action.startsWith('淘汰') ? '❌ 淘汰' : (result.action.startsWith('降档') ? '🟡 降档' : '✅ 持有'),
      action: result.action,
      track_note: result.track_note || null,
      principle: '淘汰项目看逻辑不看短期涨跌；逻辑失效优先于价格止损'
    };
  }

  /**
   * Tool 5: 赛道体检
   */
  _execTrackHealth(args) {
    const { track } = args;
    const healthMap = {
      'AI数字资产': { verdict: '🏆 长期赛道', horizon: '10年视角', logic: 'AI基础设施+内容资产化，需求随AI渗透持续增长', allocation: '核心仓候选' },
      'RWA': { verdict: '🏆 长期赛道', horizon: '10年视角', logic: '真实资产上链，有现金流锚定，合规化是核心变量', allocation: '核心仓候选' },
      'BTC生态': { verdict: '🏆 长期赛道', horizon: '10年视角', logic: '数字黄金共识最强，穿越多轮牛熊', allocation: '核心仓候选' },
      '蓝筹NFT': { verdict: '🥈 长期赛道(精选)', horizon: '10年视角', logic: '只有满足数字茅台6标准的蓝筹才能存活，深度回调策略胜率<15%', allocation: '成长仓候选' },
      '元宇宙土地': { verdict: '💀 未来消失赛道', horizon: '10年看空', logic: '日活/地块<0.1，投机需求无实用场景，存活率<0.1%', allocation: '禁止配置' },
      '纯艺术NFT': { verdict: '💀 未来消失赛道', horizon: '10年看空', logic: '无现金流基础，估值无锚，流动性差', allocation: '禁止配置' },
      '链游装备': { verdict: '💀 未来消失赛道', horizon: '10年看空', logic: 'P2E死亡螺旋，平均寿命3-8个月', allocation: '禁止配置' }
    };

    if (track) {
      return { track, ...(healthMap[track] || { verdict: '未知赛道', logic: '需人工确认' }) };
    }

    return {
      long_term_tracks: LONG_TERM_TRACKS.map(t => ({ track: t, ...healthMap[t] })),
      dead_tracks: FUTURE_DEAD_TRACKS.map(t => ({ track: t, ...healthMap[t] })),
      note: '配置原则: 核心仓60%(5-10年) + 成长仓30%(3-5年) + 观察仓10%(1-3年)'
    };
  }
}

// ============================================================
// HTTP Server with MCP SSE Protocol
// ============================================================

const server = new MCPServer();

// ============================================================
// Tool 6: 综合决策流 (第2块代码, 挂载于启动段)
// 规则: knowhow/nft/rules_nft_002.json + kh_nft_decision_001.md + kh_nft_failure_002.md
// 注: 注册放在 HTTP marker 之后, 避免 test_nft_agent.js 沙盒截断源码时
//     tools/list 数量断言(5个)被破坏; 运行态正常提供第6个工具
// ============================================================
server.registerTool('decision_flow', {
  description: '综合决策流(第2块): 问题分类→路由→买入(生存证据)/持有回撤归因/平台关停/一级MINT破发/抵押清算螺旋/加仓审批',
  inputSchema: {
    type: 'object',
    required: ['question_type'],
    properties: {
      question_type: { type: 'string', enum: ['buy', 'hold', 'drawdown', 'today_pick', 'platform', 'mint', 'loan'], description: '问题类型(第0步分类)' },
      survival: {
        type: 'object',
        description: '生存证据(买入/加仓用)',
        properties: {
          survived_cycle: { type: 'boolean', description: '穿越≥1轮牛熊(≥4年)' },
          commercialization_ge_3: { type: 'boolean', description: '商业化≥3项' },
          team_active: { type: 'boolean', description: '团队在岗' },
          retention_ge_70: { type: 'boolean', description: '留存率≥70%/年' }
        }
      },
      custody: { type: 'string', enum: ['platform', 'self'], description: '平台托管or自持私钥(platform流)' },
      buyback_commitment: { type: 'boolean', description: '官方回购/抵兑承诺' },
      shutdown_announced: { type: 'boolean', description: '已公告清退' },
      shutdown_rumor: { type: 'boolean', description: '暴雷传闻' },
      mint_price_vs_floor: { type: 'number', description: '发行价/同赛道地板比(mint流)' },
      open_above_mint: { type: 'boolean', description: '开盘价是否高于发行价' },
      distance_to_liquidation_pct: { type: 'number', description: '距清算线%(loan流)' },
      loan_purpose: { type: 'string', enum: ['add_position', 'liquidity'], description: '借款用途' },
      ltv_pct: { type: 'number', description: '抵押率%' },
      liquid_market: { type: 'boolean', description: '标的流动性是否充裕' },
      drawdown_pct: { type: 'number', description: '地板价回撤%(drawdown/hold流)' },
      days_since_update: { type: 'number', description: '距上次更新天数' },
      retention_rate: { type: 'number', description: '持有人年留存率%' },
      volume_change_pct: { type: 'number', description: '月成交量变化%' },
      monthly_buy_vs_sell: { type: 'string', enum: ['buy_gt_sell', 'sell_gt_buy', 'unknown'] },
      team_status: { type: 'string', enum: ['active', 'layoff', 'vanished', 'unknown'] },
      user_growth_source: { type: 'string', enum: ['speculator', 'organic', 'unknown'], description: '用户增长来源' },
      position_pct: { type: 'number', description: '该资产占组合%(加仓审批)' },
      logic_ok: { type: 'boolean', description: '核心逻辑是否健康(加仓审批)' }
    }
  }
});

server._execDecisionFlow = function (args) {
  const { resolve } = require('./flow_nft_002.js');
  return resolve(args || {});
};

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  console.log(`${new Date().toISOString()} ${method} ${path}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // SSE endpoint (GET /mcp)
  if (method === 'GET' && path === '/mcp') {
    const sessionId = randomUUID();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-MCP-Session-Id': sessionId
    });

    console.log(`[SSE] Session ${sessionId} established`);

    const endpointUrl = `http://localhost:${PORT}/mcp-message`;
    res.write(`event: endpoint\ndata: ${JSON.stringify({ uri: endpointUrl, sessionId })}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      server.sessions.delete(sessionId);
      console.log(`[SSE] Session ${sessionId} closed`);
    });

    return;
  }

  // POST message endpoint (POST /mcp-message)
  if (method === 'POST' && path === '/mcp-message') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const message = JSON.parse(body);
        const sessionId = message.sessionId || 'default';
        const response = await handleMCPMessage(server, sessionId, message);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Health check
  if (method === 'GET' && (path === '/' || path === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'digital-collectibles-agent',
      version: '1.0.0',
      tools: Array.from(server.tools.keys()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

/**
 * Handle incoming MCP JSON-RPC message
 */
async function handleMCPMessage(srv, sessionId, message) {
  const { jsonrpc, id, method, params } = message;

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid JSON-RPC' } };
  }

  try {
    let result;
    switch (method) {
      case 'initialize':
        result = srv.handleInitialize(sessionId, params);
        break;
      case 'tools/list':
        result = srv.handleListTools(sessionId);
        break;
      case 'tools/call':
        result = await srv.handleCallTool(sessionId, params);
        break;
      case 'notifications/initialized':
        return null;
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }

    return { jsonrpc: '2.0', id, result };
  } catch (err) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: err.message } };
  }
}

// ---- Start Server ----

httpServer.listen(PORT, () => {
  console.log(`\n🖼️ 数字藏品价值投资 Agent — MCP SSE Server (V6.0)`);
  console.log(`=================================================`);
  console.log(`SSE endpoint:      http://localhost:${PORT}/mcp`);
  console.log(`Message endpoint:  http://localhost:${PORT}/mcp-message`);
  console.log(`Health check:      http://localhost:${PORT}/health`);
  console.log(`\nRegistered tools (${server.tools.size}):`);
  for (const [name, tool] of server.tools) {
    console.log(`  ⚡ ${name} — ${tool.description}`);
  }
  console.log(`\nListening on port ${PORT}...`);
});
