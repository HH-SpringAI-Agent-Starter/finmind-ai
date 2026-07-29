/**
 * 风险监控引擎 — Risk Monitor
 *
 * 规则来源: kh_stock_decision_001.md — 量化时代卖出决策流
 *          kh_stock_failure_001.md — 5/26血案 + 量化时代认知
 */

// 七类🔴信号清单
const RED_SIGNAL_TYPES = [
  { id: 1, name: '纳指暴跌', check: (d) => d.nasdaq_change_pct !== undefined && d.nasdaq_change_pct < -2 },
  { id: 2, name: '科技巨头集体下跌', check: (d) => (d.mag7_drops || 0) >= 3 },
  { id: 3, name: '黄金破位', check: (d) => d.gold_change_pct !== undefined && d.gold_change_pct < -2 },
  { id: 4, name: '比特币崩盘', check: (d) => d.bitcoin_change_pct !== undefined && d.bitcoin_change_pct < -5 },
  { id: 5, name: 'VIX飙升', check: (d) => d.vix_change_pct !== undefined && d.vix_change_pct > 20 },
  { id: 6, name: '中概暴跌', check: (d) => d.china_etf_change_pct !== undefined && d.china_etf_change_pct < -2.5 },
  { id: 7, name: '原油暴跌', check: (d) => d.wti_change_pct !== undefined && d.wti_change_pct < -3 }
];

class RiskMonitor {
  constructor() {
    this.redSignalTypes = RED_SIGNAL_TYPES;
  }

  /**
   * 全量风险扫描
   * @param {object} marketData - 隔夜市场数据
   * @returns {object} 扫描结果 + 行动建议
   */
  scan(marketData) {
    // 1. 扫描🔴信号
    const triggeredSignals = this.redSignalTypes
      .filter(st => st.check(marketData))
      .map(st => ({
        id: st.id,
        name: st.name,
        icon: '🔴',
        detail: this._getSignalDetail(st.id, marketData)
      }));

    const totalSignals = triggeredSignals.length;

    // 2. 判定等级
    const alertLevel = this._calcAlertLevel(totalSignals);

    // 3. 生成行动建议
    const actions = this._generateActions(alertLevel, totalSignals, marketData);

    // 4. 量化情绪检查
    const quantSignals = this._checkQuantSignals(marketData);

    return {
      scan_time: new Date().toISOString(),
      total_red_signals: totalSignals,
      signals: triggeredSignals,
      quant_signals: quantSignals,
      alert_level: alertLevel,
      actions,
      severity: alertLevel === 'CRITICAL' ? '🚨极端风险' :
                alertLevel === 'HIGH' ? '⚠️高风险' : '✅正常',
      rules_triggered: this._getTriggeredRules(totalSignals, alertLevel)
    };
  }

  /**
   * 判定预警等级
   */
  _calcAlertLevel(totalSignals) {
    if (totalSignals >= 5) return 'CRITICAL';   // 5+ 🔴 → 极端风险
    if (totalSignals >= 4) return 'HIGH';       // 4+ 🔴 → 高风险
    if (totalSignals >= 2) return 'MEDIUM';     // 2-3 🔴 → 中等风险
    if (totalSignals >= 1) return 'LOW';        // 1 🔴 → 低风险
    return 'NONE';                                // 0 🔴 → 安全
  }

  /**
   * 生成行动建议
   */
  _generateActions(alertLevel, totalSignals, marketData) {
    const actions = [];
    const now = new Date();
    const hour = now.getUTCHours() + 8; // Asia/Shanghai

    switch (alertLevel) {
      case 'CRITICAL':
        actions.push({
          time: '07:00',
          action: '🚨 开盘减仓至≤30%',
          detail: `${totalSignals}个🔴信号触发。建议开盘即减仓，不等确认`
        });
        actions.push({
          time: '09:25',
          action: '推送实时跌幅',
          detail: '开盘后每30分钟推送一次实时跌幅'
        });
        actions.push({
          time: '14:30',
          action: '强制推送卖出提醒',
          detail: '无论是否已经减仓，都必须推送一次卖出提醒'
        });
        break;

      case 'HIGH':
        actions.push({
          time: '07:00',
          action: '⚠️ 今日高风险，建议减仓',
          detail: `${totalSignals}个🔴信号触发。今日不宜开新仓`
        });
        actions.push({
          time: '09:25',
          action: '推送实时跌幅',
          detail: '开盘后每30分钟推送一次实时跌幅'
        });
        break;

      case 'MEDIUM':
        actions.push({
          time: '07:00',
          action: '🟡 注意风险，控制仓位',
          detail: `${totalSignals}个🔴信号。降低持仓比例，避免追高`
        });
        break;

      case 'LOW':
        actions.push({
          time: '07:00',
          action: '🟢 基本正常',
          detail: `${totalSignals}个🔴信号。正常操作，适当关注`
        });
        break;

      case 'NONE':
        actions.push({
          time: '07:00',
          action: '✅ 无风险信号',
          detail: '隔夜无🔴信号触发，正常操作'
        });
        break;
    }

    return actions;
  }

  /**
   * 量化情绪信号检查
   */
  _checkQuantSignals(marketData) {
    const signals = [];

    // 量化时代特有信号
    if (marketData.meta_ai_selloff) {
      signals.push({
        type: '量化驱动',
        detail: 'Meta卖算力/科技巨头削减CAPEX信号',
        action: '🚨 量化时代·信号出即卖，不等确认'
      });
    }

    return signals;
  }

  /**
   * 获取具体信号详情
   */
  _getSignalDetail(id, data) {
    switch (id) {
      case 1: return `纳指 ${data.nasdaq_change_pct}% (阈值:跌>2%)`;
      case 2: return `科技七巨头 ${data.mag7_drops}只跌>3% (阈值:≥3只)`;
      case 3: return `黄金 ${data.gold_change_pct}% (阈值:跌>2%)`;
      case 4: return `比特币 ${data.bitcoin_change_pct}% (阈值:跌>5%)`;
      case 5: return `VIX ${data.vix_change_pct}% (阈值:涨>20%)`;
      case 6: return `中概金龙 ${data.china_etf_change_pct}% (阈值:跌>2.5%)`;
      case 7: return `WTI原油 ${data.wti_change_pct}% (阈值:跌>3%)`;
      default: return '未知信号';
    }
  }

  /**
   * 触发规则记录
   */
  _getTriggeredRules(totalSignals, alertLevel) {
    const rules = [];
    if (alertLevel === 'CRITICAL') {
      rules.push('累计≥5个🔴→开盘减仓至≤30%+14:30前推送卖出提醒');
    }
    if (alertLevel === 'HIGH') {
      rules.push('累计≥4个🔴→07:00预警含"⚠️今日高风险"');
    }
    if (alertLevel === 'HIGH' || alertLevel === 'CRITICAL') {
      rules.push('多信号共振→视为等同于纳指跌>3%处理');
      rules.push('量化驱动信号→信号出即卖，不等确认(跑得快比跑得准重要)');
    }
    return rules;
  }

  /**
   * 持续监控检查(盘中每15分钟)
   */
  intradayCheck(currentData) {
    const base = this.scan(currentData);
    
    // 盘中追加行动: 如果盘中跌幅扩大
    if (currentData.intraday_drop_pct !== undefined) {
      if (currentData.intraday_drop_pct < -3) {
        base.actions.push({
          time: '盘中',
          action: '🚨 盘中跌幅>3%，强制减仓',
          detail: `当前跌幅${currentData.intraday_drop_pct}%，不等收盘`
        });
      }
      if (currentData.intraday_drop_pct < -5) {
        base.actions.push({
          time: '盘中',
          action: '🚨🚨 盘中跌幅>5%，全部清仓',
          detail: '恐慌性暴跌，清仓保护本金'
        });
      }
    }

    return base;
  }
}

module.exports = { RiskMonitor, RED_SIGNAL_TYPES };
