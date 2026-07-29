/**
 * 信号捕获引擎 — Signal Capture Engine
 *
 * 基于 Event Discovery Engine V2 架构（ABCDEFGH八类事件）
 * 规则来源: kh_stock_failure_001.md (脑机接口教训) + kh_stock_rules_001.md
 */

// 八类事件定义
const EVENT_CATEGORIES = {
  A: { name: '价值拐点', icon: '🔴', sources: ['公司公告', '药监局', '客户认证'], examples: ['注册证获批', 'III期成功', '首条产线', '首单'] },
  B: { name: '供需变化', icon: '🟠', sources: ['行业报价', '公司公告'], examples: ['涨价', '断供', '减产', '去库'] },
  C: { name: '资金异动', icon: '🟡', sources: ['龙虎榜', 'Level2', '板块联动'], examples: ['连续放量', 'ETF流入', '北向'] },
  D: { name: '政策信号', icon: '🟢', sources: ['国务院', '工信部', '发改委'], examples: ['产业政策', '补贴', '监管放行'] },
  E: { name: '技术突破', icon: '🔵', sources: ['论文', '会议', '发布会'], examples: ['DeepSeek', 'AlphaFold', '固态电池'] },
  F: { name: '产业链事件', icon: '🟣', sources: ['巨头官网', '产业链调研'], examples: ['Apple/Tesla/NVDA动作', '拆链'] },
  G: { name: '资本事件', icon: '⚪', sources: ['交易所公告'], examples: ['IPO', '回购', '减持', '收购'] },
  H: { name: '国际事件', icon: '🟤', sources: ['海外媒体', '央行', 'Fed'], examples: ['关税', '制裁', '军事', 'OPEC'] }
};

// 涨价信号触发词（自动识别）
const PRICE_SIGNAL_TRIGGERS = [
  '涨价', '提价', '调涨', '价格上调', '价格突破', '历史新高',
  '断供', '缺货', '产能不足', '供不应求', '交付延长',
  '库存新低', '去库加速', '开工率下降', '检修', '停产',
  '龙头发函', '供应商通知', '竞拍溢价',
  '首条产线', '首批量产', '全球首批', '国内首条', '产能量产', '投产', '竣工投产',
  '国家级工程', '全球首条',
  '涨停', '连板', '放量'
];

class SignalCaptureEngine {
  /**
   * 分类并分析信号
   * @param {string} text - 原始信号文本
   * @param {string} source - 信号来源
   * @returns {object} 分析结果
   */
  analyze(text, source = 'unknown') {
    const category = this._classify(text);
    const urgency = this._calcUrgency(category, text);
    const triggers = this._matchTriggers(text);

    return {
      text,
      source,
      category,
      urgency,
      triggers,
      lifecycle_phase: this._getLifecyclePhase(text, category),
      action: urgency >= 8
        ? '🚨 当天必须拆分，不等日报不等定时'
        : urgency >= 5
        ? '⚠️ 加入当日扫描列表，12:00前完成拆分'
        : '📋 记录待观察，下次定时任务检查'
    };
  }

  /**
   * 信号分类 (ABCDEFGH)
   */
  _classify(text) {
    const t = text.toLowerCase();

    // A类: 价值拐点
    if (t.match(/注册证|上市批准|商业化|首条产线|首批量产|通过.*验证|切入.*供应链|iii期|获批/)) {
      return 'A';
    }
    // B类: 供需变化
    if (t.match(/涨价|涨幅|提价|断供|缺货|去库|库存新低|停产|检修|开工率|产能不足|发函/)) {
      return 'B';
    }
    // C类: 资金异动
    if (t.match(/龙虎榜|主力净流入|放量|涨停|连板|板块联动/)) {
      return 'C';
    }
    // D类: 政策信号
    if (t.match(/政策|国务院|工信部|补贴|专项|政府采购|国产替代|监管/)) {
      return 'D';
    }
    // E类: 技术突破
    if (t.match(/突破|研发出|新型|论文|llm|大模型|ai|神经|芯片|固态电池|脑机/)) {
      return 'E';
    }
    // F类: 产业链事件
    if (t.match(/nvidia|apple|tesla|华为|代工|订单|扩产|供应商|产业链/)) {
      return 'F';
    }
    // G类: 资本事件
    if (t.match(/ipo|回购|减持|增发|收购|重组|增资/)) {
      return 'G';
    }
    // H类: 国际事件
    if (t.match(/关税|制裁|军事|战争|fed|美联储|利率|opec|地缘/)) {
      return 'H';
    }
    return '?';
  }

  /**
   * 紧急程度评分 (1-10)
   */
  _calcUrgency(category, text) {
    let score = 5;
    if (['A', 'B'].includes(category)) score += 3;    // A/B类最高优先级
    if (this._matchTriggers(text).length > 0) score += 1; // 有匹配触发词
    if (text.match(/涨停|连板|放量/)) score += 1;
    if (text.match(/断供|制裁|紧急/)) score += 1;
    return Math.min(10, score);
  }

  /**
   * 触发词匹配
   */
  _matchTriggers(text) {
    return PRICE_SIGNAL_TRIGGERS.filter(t => text.includes(t));
  }

  /**
   * 事件生命周期阶段判断
   */
  _getLifecyclePhase(text, category) {
    // 简单规则判断
    if (text.match(/首条|首批|首次|第一|全球首/)) return 'discovery(发现期)';
    if (category === 'B') return 'explosion(爆发期)';
    if (text.match(/翻倍|新高|暴涨/)) return 'manic(高潮期)';
    return 'fermentation(发酵期)';
  }

  /**
   * 批量扫描文本(用于每日信号扫描)
   */
  batchScan(texts) {
    return texts.map(t => this.analyze(t));
  }

  /**
   * 获取所有事件类型
   */
  getEventCategories() {
    return EVENT_CATEGORIES;
  }
}

module.exports = { SignalCaptureEngine, EVENT_CATEGORIES, PRICE_SIGNAL_TRIGGERS };
