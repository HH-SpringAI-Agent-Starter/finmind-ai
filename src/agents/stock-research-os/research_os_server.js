/**
 * Research OS — MCP SSE Server
 *
 * 股票/期货 Research Operating System
 * 将A股短线博弈 + 期货周期分析的决策流程封装为MCP Agent工具
 *
 * 协议: MCP SSE (Server-Sent Events)
 * 端口: 3100
 */

const http = require('http');
const { randomUUID } = require('crypto');

const PORT = 3100;

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
    // Tool 1: 涨价信号捕获与拆分
    this.registerTool('capture_price_signal', {
      description: '捕获涨价信号并执行五阶段拆分: 发现→确认→瓶颈定位→A股映射→入池',
      inputSchema: {
        type: 'object',
        required: ['product', 'price_change_pct', 'source'],
        properties: {
          product: { type: 'string', description: '涨价品种名称' },
          price_change_pct: { type: 'number', description: '涨价幅度百分比(如30=+30%)' },
          source: { type: 'string', enum: ['industry_news', 'company_announce', 'exchange_data', 'broker_report', 'web_scan'], description: '信号来源' },
          inventory_trend: { type: 'string', enum: ['destocking', 'restocking', 'stable', 'unknown'], description: '库存方向' },
          supply_gap: { type: 'boolean', description: '是否存在供给缺口' },
          barrier: { type: 'boolean', description: '是否存在进入壁垒' }
        }
      }
    });

    // Tool 2: S级判定
    this.registerTool('assess_s_grade', {
      description: '对候选标的执行S级判定: 产业链/急拉/横盘起量/双重共振',
      inputSchema: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string', description: '股票代码(如600105)' },
          name: { type: 'string', description: '股票名称' },
          source_type: {
            type: 'string',
            enum: ['industry_chain', 'sprint_alert', 's2a_breakout', 'zhaimao_sprint', 'manual'],
            description: '来源类型'
          },
          chain_complete: { type: 'boolean', description: '七步推导是否完成' },
          profit_pool_confirmed: { type: 'boolean', description: '利润池最大环节是否确认' },
          multi_factor_resonance: { type: 'boolean', description: '多因子是否共振' },
          horizontal_days: { type: 'integer', description: '横盘天数(≥60)' },
          amplitude_15to45: { type: 'boolean', description: '振幅15-45%' },
          volume_ratio: { type: 'number', description: '量比(>2)' },
          zhaimao_days: { type: 'integer', description: '摘帽后天数(≤30)' }
        }
      }
    });

    // Tool 3: 风险信号扫描
    this.registerTool('check_risk_signals', {
      description: '扫描七类🔴风险信号，判断是否需要减仓预警',
      inputSchema: {
        type: 'object',
        required: [],
        properties: {
          nasdaq_change_pct: { type: 'number', description: '纳指涨跌幅%' },
          mag7_drops: { type: 'integer', description: '科技七巨头中跌>3%的数量' },
          gold_change_pct: { type: 'number', description: '黄金涨跌幅%' },
          bitcoin_change_pct: { type: 'number', description: '比特币涨跌幅%' },
          vix_change_pct: { type: 'number', description: 'VIX涨跌幅%' },
          china_etf_change_pct: { type: 'number', description: '中概金龙指数涨跌幅%' },
          wti_change_pct: { type: 'number', description: 'WTI原油涨跌幅%' }
        }
      }
    });

    // Tool 4: S级全回测
    this.registerTool('daily_retrospect', {
      description: 'S级全回测·涨跌归因: 四源全覆盖，每只逐只归因',
      inputSchema: {
        type: 'object',
        required: ['s_grade_pool'],
        properties: {
          s_grade_pool: {
            type: 'array',
            description: 'S级关注池',
            items: {
              type: 'object',
              required: ['code', 'name', 'category'],
              properties: {
                code: { type: 'string' },
                name: { type: 'string' },
                category: { type: 'string', enum: ['A', 'B', 'C', 'BC'] },
                today_change_pct: { type: 'number' },
                core_logic: { type: 'string', description: '核心逻辑' },
                peak_price_retreat_pct: { type: 'number', description: '从最高价回撤百分比' },
                turnover_rate: { type: 'number', description: '换手率%' },
                capital_net_outflow: { type: 'boolean', description: '主力是否净流出' },
                original_price: { type: 'number', description: '推荐时价格' },
                current_price: { type: 'number' }
              }
            }
          }
        }
      }
    });

    // Tool 5: 四段式分析框架
    this.registerTool('quarterly_analysis', {
      description: '行业/主题四段式分析: 期货端→A股四梯队→对比表→风险',
      inputSchema: {
        type: 'object',
        required: ['subject'],
        properties: {
          subject: { type: 'string', description: '分析对象(行业/主题)' },
          futures_contract: { type: 'string', description: '相关期货合约(如有)' }
        }
      }
    });

    // Tool 6: 底部横盘涨停检测
    this.registerTool('s2a_detection', {
      description: '检测S2a信号: 横盘≥60天+振幅15-45%+放量起量加速',
      inputSchema: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          horizontal_days: { type: 'integer', description: '横盘天数' },
          amplitude_high: { type: 'number', description: '横盘区间最高振幅%' },
          amplitude_low: { type: 'number', description: '横盘区间最低振幅%' },
          minute_accel_pct: { type: 'number', description: '分钟级加速幅度%' },
          volume_ratio: { type: 'number', description: '量比' },
          distance_to_limit: { type: 'number', description: '距离涨停价%' },
          hit_limit_up: { type: 'boolean', description: '是否涨停' },
          industry_logic: { type: 'string', description: '产业逻辑描述' }
        }
      }
    });
  }

  registerTool(name, spec) {
    this.tools.set(name, spec);
  }

  // ---- MCP Protocol Handlers ----

  handleInitialize(sessionId, params) {
    const { protocolVersion, capabilities, clientInfo } = params;
    return {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'stock-research-os',
        version: '1.0.0'
      }
    };
  }

  handleListTools(sessionId) {
    const tools = [];
    for (const [name, spec] of this.tools) {
      tools.push({
        name,
        description: spec.description,
        inputSchema: spec.inputSchema
      });
    }
    return { tools };
  }

  async handleCallTool(sessionId, params) {
    const { name, arguments: args } = params;
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      };
    }

    try {
      let result;
      switch (name) {
        case 'capture_price_signal':
          result = this._execCapturePriceSignal(args);
          break;
        case 'assess_s_grade':
          result = this._execAssessSGrade(args);
          break;
        case 'check_risk_signals':
          result = this._execCheckRiskSignals(args);
          break;
        case 'daily_retrospect':
          result = this._execDailyRetrospect(args);
          break;
        case 'quarterly_analysis':
          result = this._execQuarterlyAnalysis(args);
          break;
        case 's2a_detection':
          result = this._execS2aDetection(args);
          break;
        default:
          result = { text: `Tool ${name} executed (no implementation)` };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  }

  // ============================================================
  // Core Logic Implementations (基于 Know-how 决策流)
  // ============================================================

  /**
   * 涨价信号捕获与五阶段拆分
   * 规则来源: kh_stock_rules_001.md + kh_stock_decision_001.md
   */
  _execCapturePriceSignal(args) {
    const { product, price_change_pct, source, inventory_trend = 'unknown', supply_gap = false, barrier = false } = args;

    // 阶段①: 发现期 — S级准入判定
    let grade = '⚠️观察';
    let reason = '';

    if (price_change_pct > 50 && supply_gap && barrier) {
      grade = '⭐S级(最高确定性)';
      reason = '涨幅>50%+供给缺口+壁垒 = 最高确定性';
    } else if (price_change_pct > 30 && inventory_trend === 'destocking') {
      grade = '⭐S级';
      reason = '涨幅>30%+去库确认';
    } else if (price_change_pct > 30) {
      grade = '⭐S级';
      reason = '涨幅>30%';
    } else if (price_change_pct > 10 && (supply_gap || barrier)) {
      grade = '🟡观察(等确认升级)';
      reason = '涨幅<30%但有供给刚性，需等确认';
    } else {
      grade = '⚠️不进S级';
      reason = '涨幅<30%且无瓶颈环节';
    }

    // 阶段①: 三分法归类
    let category = '🟡加工组件';
    if (product.match(/铜|铝|锌|铅|镍|锡|原油|黄金|纯碱|玻璃|螺纹|铁矿|煤炭/)) {
      category = '🔴大宗商品';
    } else if (product.match(/硅片|光刻胶|靶材|特种气体|湿电子化学品|磷化工|氟化工/)) {
      category = '🟢技术稀缺品';
    }

    // 阶段②: 四问判断
    const fourQuestions = {
      demand_or_supply: supply_gap ? '供给推(供给缺口)' : (inventory_trend === 'destocking' ? '供需双驱动(需求拉+去库)' : '未知'),
      has_bottleneck: barrier ? '是(有壁垒)' : '否(无壁垒/谁都能扩产)',
      macro_sensitive: category === '🔴大宗商品' ? '是(宏观敏感)' : '否',
      inventory_direction: inventory_trend === 'destocking' ? '🟢去库=利多' : (inventory_trend === 'restocking' ? '🔴累库=利空' : '未知')
    };

    // 阶段②: 瓶颈环节定位(示例逻辑)
    const bottleneckAnalysis = {
      product,
      bottleneck_identified: barrier,
      profit_pool: barrier ? `${product}环节定价权最强→利润池最大→优先推荐` : '无瓶颈环节，竞争充分，利润分散'
    };

    return {
      signal: { product, price_change_pct: `${price_change_pct}%`, source, timestamp: new Date().toISOString() },
      phase1_discovery: { grade, reason, category },
      phase2_confirmation: {
        four_questions: fourQuestions,
        bottleneck: bottleneckAnalysis,
        action: grade.startsWith('⭐') ? '当天入⭐S级，次日回踩是买点' : '不入池，持续监控'
      },
      phase3_5_roadmap: {
        entry: '次日回踩确认后买入',
        hold: '每日验证逻辑，跟踪价格/库存/开工率',
        exit_conditions: [
          '条件A: 价格从高点回撤>15% → 强制降级',
          '条件B: 天量换手>10%+主力净流出 → 减仓',
          '条件C: 板块情绪过热+异动公告密集 → 减仓'
        ],
        max_hold_days: '涨价类S级在阶段③结束后最长持有≤7个交易日'
      }
    };
  }

  /**
   * S级判定
   * 规则来源: kh_stock_rules_001.md — S级判定规则 + 四维度框架
   */
  _execAssessSGrade(args) {
    const {
      code, name, source_type, chain_complete, profit_pool_confirmed,
      multi_factor_resonance, horizontal_days, amplitude_15to45,
      volume_ratio, zhaimao_days
    } = args;

    const results = [];
    let finalGrade = '普通';
    let tags = [];
    let buyAdvice = '';

    // 摘帽+涨停 → S级最高优先级(独立于三源)
    if (source_type === 'zhaimao_sprint' && zhaimao_days <= 30) {
      finalGrade = '🚨S级(摘帽急拉·最高优先级)';
      tags.push('🚨摘帽急拉');
      if (zhaimao_days <= 5) {
        buyAdvice = '摘帽5天内涨停→严重最高优先级，立即推送，次日回踩买点';
      }
    }

    // S级B·产业链
    if (source_type === 'industry_chain' && chain_complete && profit_pool_confirmed && multi_factor_resonance) {
      finalGrade = '⭐S级B·产业链';
      tags.push('⭐S级B');
      buyAdvice = '七步推导完成+利润池确认+多因子共振→先入⭐S级池，等回踩买点';
    }

    // S级C·横盘起量
    if ((source_type === 's2a_breakout') && horizontal_days >= 60 && amplitude_15to45 && volume_ratio > 2) {
      if (finalGrade.startsWith('⭐S级B')) {
        finalGrade = '⭐S级BC·双重共振(最高确定性)';
        tags.push('⭐S级BC');
        buyAdvice = '产业逻辑+横盘突破双重共振→买点出现时优先推荐';
      } else {
        finalGrade = '⭐S级C·横盘起量';
        tags.push('⭐S级C');
        buyAdvice = '底部横盘≥60天+放量突破→涨停是启动信号，次日回踩才是买点';
      }
    }

    // S级A·急拉(不覆盖已有判定)
    if (source_type === 'sprint_alert' && !finalGrade.startsWith('⭐')) {
      finalGrade = '⭐S级A·急拉';
      tags.push('⭐S级A');
      buyAdvice = '急拉涨停+产业逻辑共振→标注⚠️当前热闹，等回踩再入';
    }

    // 排除规则检查
    const exclusions = [];
    if (code.startsWith('688')) exclusions.push('科创板(688)排除');
    if (code.startsWith('300')) exclusions.push('创业板(300)排除');
    if (code.startsWith('920') || code.startsWith('8')) exclusions.push('北交所排除');

    return {
      code,
      name,
      finalGrade,
      tags,
      exclusions: exclusions.length > 0 ? exclusions : ['无排除项'],
      buyAdvice,
      source_type,
      next_action: finalGrade.includes('S级') ? '追加到⭐日频S级关注池' : '不入S级池，标注对应档位',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 风险信号扫描 (七类🔴)
   * 规则来源: kh_stock_failure_001.md 失败案例E + kh_stock_decision_001.md
   */
  _execCheckRiskSignals(args) {
    const signals = [];

    // 七类🔴信号检查
    if (args.nasdaq_change_pct !== undefined && args.nasdaq_change_pct < -2) {
      signals.push({ type: '①', label: '纳指跌>2%', detail: `纳指${args.nasdaq_change_pct}%`, severity: '🔴' });
    }
    if (args.mag7_drops !== undefined && args.mag7_drops >= 3) {
      signals.push({ type: '②', label: '科技七巨头≥3只跌>3%', detail: `${args.mag7_drops}只`, severity: '🔴' });
    }
    if (args.gold_change_pct !== undefined && args.gold_change_pct < -2) {
      signals.push({ type: '③', label: '黄金单日跌>2%', detail: `黄金${args.gold_change_pct}%`, severity: '🔴' });
    }
    if (args.bitcoin_change_pct !== undefined && args.bitcoin_change_pct < -5) {
      signals.push({ type: '④', label: '比特币单日跌>5%', detail: `BTC${args.bitcoin_change_pct}%`, severity: '🔴' });
    }
    if (args.vix_change_pct !== undefined && args.vix_change_pct > 20) {
      signals.push({ type: '⑤', label: 'VIX涨>20%', detail: `VIX+${args.vix_change_pct}%`, severity: '🔴' });
    }
    if (args.china_etf_change_pct !== undefined && args.china_etf_change_pct < -2.5) {
      signals.push({ type: '⑥', label: '中概金龙指数跌>2.5%', detail: `中概${args.china_etf_change_pct}%`, severity: '🔴' });
    }
    if (args.wti_change_pct !== undefined && args.wti_change_pct < -3) {
      signals.push({ type: '⑦', label: 'WTI原油跌>3%', detail: `WTI${args.wti_change_pct}%`, severity: '🔴' });
    }

    const totalSignals = signals.length;

    let action = '✅ 无风险信号，正常操作';
    if (totalSignals >= 4 && totalSignals < 5) {
      action = `⚠️ ${totalSignals}个🔴 → 今日高风险，建议减仓。开盘后每30分钟推送实时跌幅`;
    } else if (totalSignals >= 5) {
      action = `🚨 ${totalSignals}个🔴 → 直接建议开盘减仓至≤30%。14:30前必须推送卖出提醒`;
    }

    // 量化信号检查
    const quantSignals = [];

    return {
      scan_time: new Date().toISOString(),
      total_red_signals: totalSignals,
      signals,
      quant_signals: quantSignals,
      action,
      is_red_alert: totalSignals >= 4,
      severity: totalSignals >= 5 ? '🚨极端风险' : (totalSignals >= 4 ? '⚠️高风险' : '✅正常'),
      rules_applied: [
        '累计≥4个🔴→预警+减仓建议',
        '累计≥5个🔴→开盘减仓至≤30%',
        '量化信号→信号出即卖，不等确认'
      ]
    };
  }

  /**
   * S级全回测·涨跌归因
   * 规则来源: kh_stock_decision_001.md — S级全回测决策流
   */
  _execDailyRetrospect(args) {
    const { s_grade_pool } = args;

    const results = s_grade_pool.map(item => {
      const {
        code, name, category, today_change_pct, core_logic,
        peak_price_retreat_pct = 0, turnover_rate = 0,
        capital_net_outflow = false, original_price = 0, current_price = 0
      } = item;

      // 退出三条件检查
      const exitReasons = [];
      if (peak_price_retreat_pct > 15) {
        exitReasons.push(`条件A: 价格从高点回撤${peak_price_retreat_pct}%>15% → 🚨强制降🟡观察`);
      }
      if (turnover_rate > 10 && capital_net_outflow) {
        exitReasons.push(`条件B: 天量换手${turnover_rate}%+主力净流出 → 🚨当日减仓`);
      }
      // 注意: 条件C(板块情绪过热)需外部数据，这里作为框架预留

      // 逻辑状态判定
      let logicStatus = '⚠️持稳';
      if (exitReasons.length > 0) {
        logicStatus = '❌反转(触发退出条件)';
      } else if (today_change_pct < -5 && declineLogicEnhanced(core_logic)) {
        logicStatus = '✅强化(跌但逻辑更强=买点)';
      } else if (today_change_pct < -3) {
        logicStatus = '⚠️背离预警(价格跌但逻辑未变，需六维度分析)';
      } else if (today_change_pct > 0) {
        logicStatus = '⚠️持稳(逻辑正常运行)';
      }

      // 六维度分析(仅下跌时)
      let sixDimensionAnalysis = null;
      if (today_change_pct < 0) {
        sixDimensionAnalysis = {
          今天为什么跌: today_change_pct < -5 ? '大盘拖累/板块回调/个股利空(需确认)' : '正常波动',
          核心逻辑还在吗: exitReasons.length > 0 ? '逻辑可能反转→需验证' : '逻辑仍在',
          短期回踩vs逻辑反转: exitReasons.length > 0 ? '触发退出条件→偏向反转' : '偏向短期回踩',
          历史同类反弹周期: '根据历史复盘，供参考',
          到买点了吗: exitReasons.length > 0 ? '否(触发退出)' : '需看次日是否企稳',
          大盘影响: today_change_pct < -3 ? '大盘拖累明显→减仓观望' : '影响有限→可持有'
        };
      }

      const profitLoss = original_price > 0 ? ((current_price - original_price) / original_price * 100).toFixed(2) : 'N/A';

      return {
        code,
        name,
        category: `源${category}`,
        today_change: `${today_change_pct}%`,
        profit_loss_since_recommend: `${profitLoss}%`,
        logic_status: logicStatus,
        exit_triggers: exitReasons,
        six_dimension_analysis: sixDimensionAnalysis,
        price_data: {
          original_price,
          current_price,
          peak_retreat: `${peak_price_retreat_pct}%`,
          turnover_rate: `${turnover_rate}%`,
          capital_outflow: capital_net_outflow ? '是' : '否'
        },
        action: exitReasons.length > 0 ? '🚨触发退出，执行减仓' : '继续持有，跟踪逻辑'
      };
    });

    return {
      date: new Date().toISOString().split('T')[0],
      pool_size: results.length,
      results,
      summary: {
        total: results.length,
        status_enhanced: results.filter(r => r.logic_status === '✅强化').length,
        status_stable: results.filter(r => r.logic_status === '⚠️持稳').length,
        status_divergence: results.filter(r => r.logic_status === '⚠️背离预警').length,
        status_reversed: results.filter(r => r.logic_status === '❌反转').length,
        exit_triggered: results.filter(r => r.exit_triggers.length > 0).length
      }
    };
  }

  /**
   * 四段式分析框架
   * 规则来源: kh_stock_rules_001.md — 输出格式规则
   */
  _execQuarterlyAnalysis(args) {
    const { subject, futures_contract } = args;

    return {
      subject,
      sections: {
        section1_futures: {
          title: '第一段: 期货端',
          has_contract: futures_contract || '无直接期货合约',
          mapping_path: futures_contract ? `${futures_contract}合约直接映射` : '无对应期货，通过产业ETF/个股传导',
          difficulty: futures_contract ? '低(直接做期货)' : '高(需个股传导)'
        },
        section2_a_share: {
          title: '第二段: A股四梯队',
          note: '需根据具体标的补充。以下为框架占位:',
          tier1_core: '🥇核心标的(弹性最大) — 待补充',
          tier2_supply_gap: '🥈供需缺口受益(弹性大) — 待补充',
          tier3_full_chain: '🥉全产业链一体化(受益全面) — 待补充',
          tier4_catalyst: '🏅转型催化/资源驱动 — 待补充'
        },
        section3_comparison: {
          title: '第三段: 对比速查表',
          note: '需根据具体标的补充。格式: 梯队/代码/名称/弹性来源/确定性星级'
        },
        section4_risk: {
          title: '第四段: 风险+待跟踪',
          risks: [
            '追高风险(板块过热时)',
            '排除过滤: 自动排除300/688/920',
            '业绩风险: Q1亏损/ROE下滑',
            '逻辑失效: 涨价品种价格回落>15%'
          ],
          pending_verification: [
            '供需缺口是否持续扩大',
            '库存方向是否去库确认',
            '产业链传导是否顺畅'
          ]
        }
      },
      filter_rules: [
        '自动过滤创业板(300)',
        '自动过滤科创板(688)',
        '自动过滤北交所(920)',
        '如全部被过滤，提示建议发掘主板替代'
      ]
    };
  }

  /**
   * S2a — 底部横盘涨停检测
   * 规则来源: kh_stock_decision_001.md — S2a决策流
   */
  _execS2aDetection(args) {
    const {
      code, name, horizontal_days, amplitude_high, amplitude_low,
      minute_accel_pct, volume_ratio, distance_to_limit,
      hit_limit_up, industry_logic
    } = args;

    const checks = {
      horizontal_ge_60_days: horizontal_days >= 60,
      amplitude_15_45: amplitude_low >= 15 && amplitude_high <= 45,
      minute_accel_gt_1_5: (minute_accel_pct || 0) >= 1.5,
      volume_ratio_gt_2: (volume_ratio || 0) > 2,
      distance_to_limit_lt_10: (distance_to_limit || 999) < 10
    };

    const allMet = Object.values(checks).every(v => v === true);
    const passedChecks = Object.entries(checks).filter(([, v]) => v === true).length;
    const totalChecks = Object.keys(checks).length;

    // S2a判定
    let grade = '❌ 不满足S2a条件';
    let priority = '低';
    let action = '持续监控';

    if (allMet && hit_limit_up) {
      grade = '🚨 S2a涨停信号确认';
      priority = '立即推送(不等定时任务)';
      action = `标注🔴S级紧急，涨停是启动信号，次日回踩才是买点。${industry_logic ? `产业逻辑: ${industry_logic} → 升级为⭐S级BC·双重共振` : ''}`;
    } else if (allMet && !hit_limit_up) {
      grade = '🟡 S2a起量加速(未涨停)';
      priority = '中等';
      action = '起量加速但未涨停，继续监控。如果涨停→立即升级为S级';
    } else if (passedChecks >= 3) {
      grade = '🟡 部分满足S2a条件';
      priority = '低';
      action = `满足${passedChecks}/${totalChecks}条件，持续关注突破信号`;
    }

    return {
      code,
      name,
      horizontal_days: `${horizontal_days}天`,
      amplitude_range: `${amplitude_low}-${amplitude_high}%`,
      checks,
      all_conditions_met: allMet,
      grade,
      priority,
      action,
      industry_logic: industry_logic || '无产业逻辑输入',
      recommendation: allMet && hit_limit_up
        ? '🚨 S2a+产业逻辑共振=最高确定性，立即推送，建议次日回踩买入'
        : '不符合S2a条件或未涨停，不推送'
    };
  }
}

// ============================================================
// HTTP Server with MCP SSE Protocol
// ============================================================

const server = new MCPServer();

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

    // Send endpoint event
    const endpointUrl = `http://localhost:${PORT}/mcp-message`;
    res.write(`event: endpoint\ndata: ${JSON.stringify({ uri: endpointUrl, sessionId })}\n\n`);

    // Keep-alive
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
      server: 'stock-research-os',
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
        // No response needed for notifications
        return null;
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        };
    }

    return { jsonrpc: '2.0', id, result };
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err.message }
    };
  }
}

/**
 * 六维度分析辅助: 判断下跌是否强化逻辑
 * 逻辑: 如果供给侧受限→跌→更多企业退出→反而强化供给逻辑
 */
function declineLogicEnhanced(coreLogic) {
  if (!coreLogic) return false;
  const enhanceKeywords = ['涨价', '供需缺口', '去库', '停产', '检修', '供给收缩', '产能不足', '断供'];
  return enhanceKeywords.some(k => coreLogic.includes(k));
}

// ---- Start Server ----

httpServer.listen(PORT, () => {
  console.log(`\n📊 股票/期货 Research OS — MCP SSE Server`);
  console.log(`==========================================`);
  console.log(`SSE endpoint:   http://localhost:${PORT}/mcp`);
  console.log(`Message endpoint: http://localhost:${PORT}/mcp-message`);
  console.log(`Health check:   http://localhost:${PORT}/health`);
  console.log(`\nRegistered tools (${server.tools.size}):`);
  for (const [name, tool] of server.tools) {
    console.log(`  ⚡ ${name} — ${tool.description}`);
  }
  console.log(`\nListening on port ${PORT}...`);
});
