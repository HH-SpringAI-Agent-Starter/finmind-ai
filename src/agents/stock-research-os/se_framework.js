/**
 * S级判定框架 — S-Grade Evaluation Framework
 *
 * 规则来源: kh_stock_rules_001.md — S级判定规则 + 四维度框架
 *          kh_stock_decision_001.md — 摘帽急拉决策流
 */

// S级标签定义
const S_GRADE_LABELS = {
  'BC': { label: '⭐S级BC·双重共振', desc: '产业逻辑+横盘突破双重共振=最高确定性', priority: 1 },
  'B': { label: '⭐S级B·产业链', desc: '七步推导+利润池确认+多因子共振', priority: 2 },
  'C': { label: '⭐S级C·横盘起量', desc: '底部横盘≥60天+放量突破', priority: 3 },
  'A': { label: '⭐S级A·急拉', desc: '急拉涨停+产业逻辑共振', priority: 4 },
  'ZHAIMAO': { label: '🚨S级(摘帽急拉)', desc: '摘帽30天内+急拉涨停=独立最高优先级', priority: 0 }
};

class SGradeFramework {
  /**
   * S级判定主入口
   */
  evaluate(stock) {
    const {
      source_type,           // 'industry_chain' | 'sprint_alert' | 's2a_breakout' | 'zhaimao_sprint'
      chain_complete,        // boolean: 七步推导完成
      profit_pool_confirmed, // boolean: 利润池最大环节确认
      multi_factor,          // boolean: 多因子共振
      horizontal_days,       // int: 横盘天数
      amplitude_low,         // number: 横盘区间最低振幅%
      amplitude_high,        // number: 横盘区间最高振幅%
      volume_ratio,          // number: 量比
      hit_limit_up,          // boolean: 是否涨停
      industry_logic,        // string: 产业逻辑
      zhaimao_days,          // int: 摘帽后天数
      is_sprint,             // boolean: 是否急拉涨停
      code                   // string: 股票代码
    } = stock;

    // Step 0: 排除规则
    const exclusions = this._checkExclusions(code);
    if (exclusions.length > 0) {
      return { grade: '❌排除', exclusions, tags: [], priority: 999 };
    }

    // Step 1: 摘帽+急拉 → 最高优先级（独立于三源）
    if (source_type === 'zhaimao_sprint' && zhaimao_days <= 30 && is_sprint) {
      return this._gradeZhaimao(zhaimao_days);
    }

    // Step 2: 产业链判定 (S级B)
    const gradeB = this._evaluateChain(chain_complete, profit_pool_confirmed, multi_factor);

    // Step 3: 横盘起量判定 (S级C)
    const gradeC = this._evaluateS2a(horizontal_days, amplitude_low, amplitude_high, volume_ratio, hit_limit_up);

    // Step 4: 急拉判定 (S级A)
    const gradeA = this._evaluateSprint(source_type, is_sprint, industry_logic);

    // Step 5: 合并判定
    return this._mergeGrades(gradeB, gradeC, gradeA);
  }

  /**
   * 摘帽+急拉判定
   */
  _gradeZhaimao(zhaimaoDays) {
    const result = {
      grade: S_GRADE_LABELS.ZHAIMAO.label,
      tags: ['🚨摘帽急拉'],
      exclusions: [],
      priority: 0,
      buyAdvice: '摘帽+急拉涨停 = 三重共振暴击',
      zhaimaoDays
    };

    if (zhaimaoDays <= 5) {
      result.buyAdvice += ' → 摘帽5天内涨停，严重最高优先级，立即推送';
      result.urgency = '🚨立即推送';
    } else {
      result.buyAdvice += ' → 摘帽30天内，高优先级';
      result.urgency = '🚨高优先级';
    }

    return result;
  }

  /**
   * 产业链判定 (S级B)
   */
  _evaluateChain(chainComplete, profitPoolConfirmed, multiFactor) {
    if (chainComplete && profitPoolConfirmed && multiFactor) {
      return {
        grade: S_GRADE_LABELS.B.label,
        tags: ['⭐S级B'],
        confirmed: true,
        priority: 2,
        buyAdvice: '先入⭐S级池，等回踩是买点',
        action: '自动追加⭐S级关注'
      };
    }
    if (chainComplete && profitPoolConfirmed) {
      return {
        grade: '🥇高确定性(接近S级)',
        tags: ['🔍产业链'],
        confirmed: false,
        priority: 5,
        buyAdvice: '七步推导完成但缺多因子共振，待确认后升级',
        action: '列入观察，等待多因子共振'
      };
    }
    return { grade: '普通', tags: [], confirmed: false, priority: 10 };
  }

  /**
   * 横盘起量判定 (S级C / S2a)
   */
  _evaluateS2a(horizontalDays, amplitudeLow, amplitudeHigh, volumeRatio, hitLimitUp) {
    const checks = {
      horizontal_ge_60: horizontalDays >= 60,
      amplitude_15_45: amplitudeLow >= 15 && amplitudeHigh <= 45,
      volume_gt_2: volumeRatio > 2
    };

    const allMet = Object.values(checks).every(v => v === true);

    if (!allMet) return null; // 不满足横盘起量条件

    if (hitLimitUp) {
      return {
        grade: S_GRADE_LABELS.C.label,
        tags: ['⭐S级C'],
        confirmed: true,
        priority: 3,
        buyAdvice: '涨停是启动信号，次日回踩才是买点',
        action: '标注🔴S级紧急，立即推送'
      };
    }

    return {
      grade: '🟡横盘起量(未涨停)',
      tags: ['📊横盘监控'],
      confirmed: false,
      priority: 8,
      buyAdvice: '起量但未涨停，继续监控',
      action: '持续关注，涨停时升级'
    };
  }

  /**
   * 急拉判定 (S级A)
   */
  _evaluateSprint(sourceType, isSprint, industryLogic) {
    if (sourceType === 'sprint_alert' && isSprint) {
      return {
        grade: S_GRADE_LABELS.A.label,
        tags: ['⭐S级A'],
        confirmed: true,
        priority: 4,
        buyAdvice: '急拉涨停，标注⚠️当前热闹，等回踩再入',
        action: '追加⭐S级关注',
        industryLogic
      };
    }
    return null;
  }

  /**
   * 合并判定 (BC双重共振)
   */
  _mergeGrades(gradeB, gradeC, gradeA) {
    // S级B + S级C → BC双重共振
    if (gradeB && gradeC && gradeB.confirmed && gradeC.confirmed) {
      return {
        grade: S_GRADE_LABELS.BC.label,
        tags: ['⭐S级BC', '双重共振'],
        exclusions: [],
        priority: 1,
        buyAdvice: '产业逻辑+横盘突破双重共振，最高确定性，买点出现时优先推荐',
        action: '立即追加⭐S级关注，标注最高优先级'
      };
    }

    // 单一S级
    const sGrades = [gradeB, gradeC, gradeA].filter(Boolean);
    if (sGrades.length > 0) {
      const best = sGrades.sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
      return {
        grade: best.grade,
        tags: best.tags,
        exclusions: [],
        priority: best.priority,
        buyAdvice: best.buyAdvice,
        action: best.action
      };
    }

    // 普通
    return {
      grade: '普通',
      tags: [],
      exclusions: [],
      priority: 99,
      buyAdvice: '不满足S级条件',
      action: '不入S级池'
    };
  }

  /**
   * 排除规则检查
   */
  _checkExclusions(code) {
    const exclusions = [];
    if (!code) return ['无股票代码'];
    if (code.startsWith('688')) exclusions.push('科创板(688)排除');
    if (code.startsWith('300')) exclusions.push('创业板(300)排除');
    if (code.startsWith('920') || (code.length === 6 && code.startsWith('8'))) exclusions.push('北交所排除');
    return exclusions;
  }

  /**
   * 批量判定
   */
  batchEvaluate(stocks) {
    return stocks.map(s => this.evaluate(s));
  }
}

module.exports = { SGradeFramework, S_GRADE_LABELS };
