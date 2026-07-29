/**
 * 股票/期货 Research OS — 综合测试
 *
 * 测试所有核心模块:
 * 1. MCP Server 工具
 * 2. 信号捕获引擎
 * 3. S级判定框架
 * 4. 风险监控引擎
 */

const assert = require('assert');
const { SGradeFramework } = require('../../src/agents/stock-research-os/se_framework');
const { SignalCaptureEngine } = require('../../src/agents/stock-research-os/signal_capture');
const { RiskMonitor } = require('../../src/agents/stock-research-os/risk_monitor');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

console.log('\n🧪 股票/期货 Research OS — 功能测试\n');

// ============================================================
// 1. S级判定框架测试
// ============================================================
console.log('📦 SGradeFramework');

const seFramework = new SGradeFramework();

test('产业链S级B判定', () => {
  const result = seFramework.evaluate({
    code: '600105',
    name: '永鼎股份',
    source_type: 'industry_chain',
    chain_complete: true,
    profit_pool_confirmed: true,
    multi_factor: true
  });
  assert(result.grade.includes('⭐S级B'));
  assert.strictEqual(result.priority, 2);
});

test('横盘起量S级C判定', () => {
  const result = seFramework.evaluate({
    code: '600183',
    name: '生益科技',
    source_type: 's2a_breakout',
    horizontal_days: 90,
    amplitude_low: 18,
    amplitude_high: 42,
    volume_ratio: 3.5,
    hit_limit_up: true
  });
  assert(result.grade.includes('⭐S级C'));
  assert.strictEqual(result.priority, 3);
});

test('BC双重共振判定', () => {
  const result = seFramework.evaluate({
    code: '605376',
    name: '博迁新材',
    source_type: 's2a_breakout',
    chain_complete: true,
    profit_pool_confirmed: true,
    multi_factor: true,
    horizontal_days: 75,
    amplitude_low: 20,
    amplitude_high: 40,
    volume_ratio: 4.0,
    hit_limit_up: true,
    industry_logic: 'MLCC镍粉80nm唯一国产'
  });
  assert(result.grade.includes('⭐S级BC') || result.priority <= 1);
});

test('摘帽急拉最高优先级', () => {
  const result = seFramework.evaluate({
    code: '600360',
    name: '华微电子',
    source_type: 'zhaimao_sprint',
    zhaimao_days: 3,
    is_sprint: true
  });
  assert(result.grade.includes('摘帽急拉'));
  assert.strictEqual(result.priority, 0);
});

test('排除规则(科创板)', () => {
  const result = seFramework.evaluate({
    code: '688146',
    name: '中船特气',
    source_type: 'industry_chain',
    chain_complete: true,
    profit_pool_confirmed: true,
    multi_factor: true
  });
  assert(result.grade === '❌排除');
  assert(result.exclusions.some(e => e.includes('688')));
});

test('排除规则(创业板)', () => {
  const result = seFramework.evaluate({
    code: '300750',
    name: '宁德时代',
    source_type: 'manual'
  });
  assert(result.grade === '❌排除');
  assert(result.exclusions.some(e => e.includes('300')));
});

test('不满足S级条件返回普通', () => {
  const result = seFramework.evaluate({
    code: '600001',
    name: '普通股',
    source_type: 'manual'
  });
  assert(result.grade === '普通');
});

// ============================================================
// 2. 信号捕获引擎测试
// ============================================================
console.log('\n📦 SignalCaptureEngine');

const captureEngine = new SignalCaptureEngine();

test('涨价信号分类为B类', () => {
  const result = captureEngine.analyze('硫磺价格突破历史新高，单月涨幅超30%', 'industry_news');
  assert.strictEqual(result.category, 'B');
  assert(result.urgency >= 8);
});

test('注册证获批分类为A类', () => {
  const result = captureEngine.analyze('赛博灵科AM5获二类医疗器械注册证', 'company_announce');
  assert.strictEqual(result.category, 'A');
});

test('技术突破分类为E类', () => {
  const result = captureEngine.analyze('团队在固态电池技术实现重大突破', 'conference');
  assert.strictEqual(result.category, 'E');
});

test('政策信号分类为D类', () => {
  const result = captureEngine.analyze('工信部发布集成电路产业补贴政策', 'gov_announce');
  assert.strictEqual(result.category, 'D');
});

test('连板信号高紧急度', () => {
  const result = captureEngine.analyze('永鼎股份连续3日涨停，光通信板块联动', 'market_data');
  assert(result.urgency >= 7);
});

test('触发词匹配', () => {
  const result = captureEngine.analyze('六氟化钨价格大幅涨价，供不应求');
  assert(result.triggers.includes('涨价'));
  assert(result.triggers.includes('供不应求') || result.triggers.length >= 2);
});

test('首条产线触发词', () => {
  const result = captureEngine.analyze('国内首条12英寸AR微纳光学晶圆产线投产');
  assert(result.triggers.some(t => t.includes('首条') || t.includes('投产')));
});

// ============================================================
// 3. 风险监控引擎测试
// ============================================================
console.log('\n📦 RiskMonitor');

const riskMonitor = new RiskMonitor();

test('无风险信号返回正常', () => {
  const result = riskMonitor.scan({
    nasdaq_change_pct: 0.5,
    mag7_drops: 0,
    gold_change_pct: 0.3,
    bitcoin_change_pct: 1.2,
    vix_change_pct: -5,
    china_etf_change_pct: 1.0,
    wti_change_pct: 0.8
  });
  assert.strictEqual(result.severity, '✅正常');
  assert.strictEqual(result.total_red_signals, 0);
});

test('4个🔴=高风险预警', () => {
  const result = riskMonitor.scan({
    nasdaq_change_pct: -2.5,   // 🔴①
    mag7_drops: 4,              // 🔴②
    gold_change_pct: -3.0,      // 🔴③
    bitcoin_change_pct: -10,    // 🔴④
    china_etf_change_pct: -1.0,
    wti_change_pct: -1.0
  });
  assert.strictEqual(result.severity, '⚠️高风险');
  assert.strictEqual(result.total_red_signals, 4);
  assert(result.actions.some(a => a.action.includes('减仓')));
});

test('5个🔴=极端风险', () => {
  const result = riskMonitor.scan({
    nasdaq_change_pct: -3.5,    // 🔴①
    mag7_drops: 5,               // 🔴②
    gold_change_pct: -4.0,       // 🔴③
    bitcoin_change_pct: -8.0,    // 🔴④
    vix_change_pct: 30,          // 🔴⑤
    china_etf_change_pct: -3.5,  // 🔴⑥
    wti_change_pct: -5.0         // 🔴⑦
  });
  assert.strictEqual(result.severity, '🚨极端风险');
  assert(result.actions.some(a => a.action.includes('减仓至')));
});

test('盘中跌幅>5%触发清仓', () => {
  const result = riskMonitor.intradayCheck({
    nasdaq_change_pct: -2.0,
    mag7_drops: 2,
    intraday_drop_pct: -5.5
  });
  assert(result.actions.some(a => a.action.includes('全部清仓')));
});

// ============================================================
// 4. 模块完整性检查
// ============================================================
console.log('\n📦 模块完整性检查');

test('SGradeFramework has evaluate method', () => {
  assert(typeof seFramework.evaluate === 'function');
});

test('SignalCaptureEngine has analyze method', () => {
  assert(typeof captureEngine.analyze === 'function');
});

test('RiskMonitor has scan method', () => {
  assert(typeof riskMonitor.scan === 'function');
});

test('RiskMonitor has intradayCheck method', () => {
  assert(typeof riskMonitor.intradayCheck === 'function');
});

test('SGradeFramework has batchEvaluate method', () => {
  assert(typeof seFramework.batchEvaluate === 'function');
});

// ============================================================
// 总结
// ============================================================
console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项\n`);

process.exit(failed > 0 ? 1 : 0);
