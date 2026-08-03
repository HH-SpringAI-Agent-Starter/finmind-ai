/**
 * 数字藏品价值投资 Agent — 测试用例
 * 覆盖: 项目评估 / 持仓配置 / 风险预警 / 淘汰判定 / 赛道体检
 * 运行: node tests/digital-collectibles/test_nft_agent.js
 */

const assert = require('assert');

// 直接加载 MCPServer 逻辑（避免启动端口）
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, '..', '..', 'src', 'agents', 'digital-collectibles', 'nft_agent_server.js');

// 读取源码并提取 MCPServer 类（不启动 HTTP server）
let source = fs.readFileSync(serverPath, 'utf8');
// 截取到 HTTP server 启动之前
const httpMarker = '// ============================================================\n// HTTP Server with MCP SSE Protocol';
source = source.substring(0, source.indexOf(httpMarker));
// 移除最后的 httpServer.listen 部分（已截断）
const sandbox = { require, console, __dirname, process };
const moduleObj = { exports: {} };
const wrapped = new Function('module', 'exports', 'require', 'console', source + '\nmodule.exports = MCPServer;');
wrapped(moduleObj, moduleObj.exports, require, console);

const MCPServer = moduleObj.exports;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

console.log('\n🧪 数字藏品Agent 测试套件');
console.log('==========================');

// ============================================================
// 1. evaluate_project — 赛道分类
// ============================================================
console.log('\n[1] evaluate_project — 赛道分类与评分');

test('元宇宙土地 → 直接拒绝（未来消失赛道）', () => {
  const srv = new MCPServer();
  const r = srv._execEvaluateProject({
    name: 'Decentraland', track: '元宇宙土地',
    scarcity_score: 90, compliance_score: 80, liquidity_score: 70, consensus_score: 85
  });
  assert.strictEqual(r.decision, '❌ 拒绝入场');
  assert.ok(r.reason.includes('未来消失赛道'));
  assert.strictEqual(r.step3_weighted_score, undefined, '未来消失赛道不应进入评分');
});

test('链游装备 → 直接拒绝', () => {
  const srv = new MCPServer();
  const r = srv._execEvaluateProject({ name: 'StepN', track: '链游装备' });
  assert.strictEqual(r.decision, '❌ 拒绝入场');
  assert.ok(r.reason.includes('P2E平均寿命'));
});

test('RWA 高分项目 → 核心仓', () => {
  const srv = new MCPServer();
  const r = srv._execEvaluateProject({
    name: '真实资产RWA', track: 'RWA',
    scarcity_score: 85, compliance_score: 90, liquidity_score: 80, consensus_score: 85,
    history_years: 5, holders: 25000, commercialization_count: 4,
    global_influence: true, founder_years: 6, retention_rate: 80
  });
  assert.strictEqual(r.step5_allocation.tier, 'core');
  assert.strictEqual(r.step4_maotai_standard.passed, '6/6');
  assert.ok(r.step3_weighted_score.total >= 80);
});

test('AI数字资产 中分项目 → 成长仓', () => {
  const srv = new MCPServer();
  const r = srv._execEvaluateProject({
    name: 'AI生成内容资产', track: 'AI数字资产',
    scarcity_score: 70, compliance_score: 65, liquidity_score: 60, consensus_score: 70,
    history_years: 4, holders: 15000, commercialization_count: 3,
    global_influence: false, founder_years: 4, retention_rate: 72
  });
  assert.strictEqual(r.step5_allocation.tier, 'growth');
});

test('低分项目 → 不入池', () => {
  const srv = new MCPServer();
  const r = srv._execEvaluateProject({
    name: '小项目', track: '蓝筹NFT',
    scarcity_score: 40, compliance_score: 30, liquidity_score: 20, consensus_score: 30,
    history_years: 1, holders: 500, commercialization_count: 0
  });
  assert.strictEqual(r.step5_allocation.tier, 'reject');
});

test('未知赛道 → 需人工确认', () => {
  const srv = new MCPServer();
  const r = srv._execEvaluateProject({ name: 'X', track: '其他' });
  assert.ok(r.decision.includes('未知赛道'));
});

// ============================================================
// 2. check_portfolio — 持仓配置
// ============================================================
console.log('\n[2] check_portfolio — 配置合规检查');

test('合规组合 → 无违规（60/30/10分层 + 每系列≤10%）', () => {
  const srv = new MCPServer();
  const r = srv._execCheckPortfolio({
    total_value: 100000,
    portfolio: [
      // core 60% = 6×10000
      { name: 'A1', tier: 'core', value: 10000, series: 'RWA-系列X' },
      { name: 'A2', tier: 'core', value: 10000, series: 'RWA-系列Y' },
      { name: 'A3', tier: 'core', value: 10000, series: 'RWA-系列Z' },
      { name: 'A4', tier: 'core', value: 10000, series: 'BTC生态-系列P' },
      { name: 'A5', tier: 'core', value: 10000, series: 'BTC生态-系列Q' },
      { name: 'A6', tier: 'core', value: 10000, series: 'AI数字资产-系列M' },
      // growth 30% = 3×10000
      { name: 'B1', tier: 'growth', value: 10000, series: 'AI数字资产-系列N' },
      { name: 'B2', tier: 'growth', value: 10000, series: 'AI数字资产-系列O' },
      { name: 'B3', tier: 'growth', value: 10000, series: '蓝筹NFT-系列R' },
      // watch 10% = 1×10000
      { name: 'C1', tier: 'watch', value: 10000, series: '蓝筹NFT-系列S' }
    ]
  });
  assert.strictEqual(r.iron_rule_violations, 0);
  assert.ok(r.overall.includes('合规'));
});

test('单系列超10% → 触发铁律', () => {
  const srv = new MCPServer();
  const r = srv._execCheckPortfolio({
    total_value: 100000,
    portfolio: [
      { name: 'A1', tier: 'core', value: 30000, series: 'RWA-系列X' },
      { name: 'A2', tier: 'core', value: 9000, series: 'RWA-系列Y' },
      { name: 'B1', tier: 'growth', value: 9000, series: 'AI数字资产-系列M' },
      { name: 'C1', tier: 'watch', value: 9000, series: '蓝筹NFT-系列R' }
    ]
  });
  assert.strictEqual(r.iron_rule_violations, 1);
  assert.ok(r.overall.includes('再平衡'));
});

test('核心仓超配 → 提示调整', () => {
  const srv = new MCPServer();
  const r = srv._execCheckPortfolio({
    total_value: 100000,
    portfolio: [
      { name: 'A', tier: 'core', value: 80000, series: 'RWA' },
      { name: 'B', tier: 'growth', value: 20000, series: 'AI数字资产' }
    ]
  });
  const coreTier = r.allocation_summary.find(t => t.tier === 'core');
  assert.strictEqual(coreTier.status, '⚠️ 超配');
});

test('空组合 → 报错保护', () => {
  const srv = new MCPServer();
  const r = srv._execCheckPortfolio({ portfolio: [] });
  assert.ok(r.error);
});

// ============================================================
// 3. risk_alert — 风险预警
// ============================================================
console.log('\n[3] risk_alert — 风险预警引擎');

test('停更90天 → 黄色警告', () => {
  const srv = new MCPServer();
  const r = srv._execRiskAlert({ name: 'P', days_since_last_update: 95 });
  assert.ok(r.alerts.some(a => a.rule.includes('停更90天')));
  assert.ok(r.overall_level.includes('🟡'));
});

test('地板价-60% → 启动深度分析', () => {
  const srv = new MCPServer();
  const r = srv._execRiskAlert({ name: 'P', floor_price_drawdown_pct: -60 });
  assert.ok(r.alerts.some(a => a.rule.includes('地板价回撤')));
  assert.ok(r.alerts.some(a => a.action.includes('深度分析')));
  assert.ok(r.overall_level.includes('🔴'));
});

test('元宇宙土地 日活/地块<0.1 → 失败模式A', () => {
  const srv = new MCPServer();
  const r = srv._execRiskAlert({
    name: 'Sandbox', track: '元宇宙土地',
    daily_active_users: 700, land_plots: 10000
  });
  assert.ok(r.alerts.some(a => a.rule.includes('元宇宙土地失败模式')));
});

test('蓝筹PFP 成交量腰斩+留存率崩 → 失败模式B', () => {
  const srv = new MCPServer();
  const r = srv._execRiskAlert({
    name: 'BAYC', track: '蓝筹NFT',
    volume_change_pct: -65, retention_rate: 50, monthly_buy_vs_sell: 'sell_gt_buy'
  });
  assert.ok(r.alerts.some(a => a.rule.includes('半山腰陷阱')));
});

test('链游 代币经济学两问失败 → 死亡螺旋', () => {
  const srv = new MCPServer();
  const r = srv._execRiskAlert({
    name: 'StepN', track: '链游装备',
    token_inflation: true, burn_scenario: false,
    player_retention_30d: 15, team_wallet_unlocked: true
  });
  assert.ok(r.alerts.some(a => a.rule.includes('链游死亡螺旋')));
});

test('正常项目 → 无预警', () => {
  const srv = new MCPServer();
  const r = srv._execRiskAlert({
    name: '健康RWA', track: 'RWA',
    days_since_last_update: 7, floor_price_drawdown_pct: -10,
    volume_change_pct: 5, retention_rate: 85, monthly_buy_vs_sell: 'buy_gt_sell', team_status: 'active'
  });
  assert.strictEqual(r.alert_count, 0);
  assert.ok(r.overall_level.includes('🟢'));
});

// ============================================================
// 4. judge_elimination — 淘汰判定
// ============================================================
console.log('\n[4] judge_elimination — 淘汰判定（看逻辑不看涨跌）');

test('逻辑完好 + 短期跌 → 继续持有', () => {
  const srv = new MCPServer();
  const r = srv._execJudgeElimination({
    name: 'P', floor_change_1m: -20, logic_status: 'logic_intact', track: 'RWA'
  });
  assert.strictEqual(r.decision, '✅ 持有');
});

test('逻辑被证伪 → 淘汰（无论涨跌）', () => {
  const srv = new MCPServer();
  const r = srv._execJudgeElimination({
    name: 'P', floor_change_1m: 30, logic_status: 'logic_falsified', track: '蓝筹NFT'
  });
  assert.strictEqual(r.decision, '❌ 淘汰');
});

test('团队跑路 → 淘汰', () => {
  const srv = new MCPServer();
  const r = srv._execJudgeElimination({
    name: 'P', logic_status: 'team_vanished', track: 'AI数字资产'
  });
  assert.strictEqual(r.decision, '❌ 淘汰');
});

test('未来消失赛道下跌 → 不抄底提示', () => {
  const srv = new MCPServer();
  const r = srv._execJudgeElimination({
    name: 'P', floor_change_1m: -35, logic_status: 'logic_intact', track: '元宇宙土地'
  });
  assert.ok(r.track_note && r.track_note.includes('加速出清'));
});

// ============================================================
// 5. track_health — 赛道体检
// ============================================================
console.log('\n[5] track_health — 赛道体检');

test('全部赛道体检 → 4长期+3消失', () => {
  const srv = new MCPServer();
  const r = srv._execTrackHealth({});
  assert.strictEqual(r.long_term_tracks.length, 4);
  assert.strictEqual(r.dead_tracks.length, 3);
});

test('单赛道体检 → RWA为核心仓候选', () => {
  const srv = new MCPServer();
  const r = srv._execTrackHealth({ track: 'RWA' });
  assert.ok(r.verdict.includes('长期赛道'));
  assert.ok(r.allocation.includes('核心仓'));
});

test('元宇宙土地 → 禁止配置', () => {
  const srv = new MCPServer();
  const r = srv._execTrackHealth({ track: '元宇宙土地' });
  assert.ok(r.verdict.includes('未来消失'));
  assert.ok(r.allocation.includes('禁止'));
});

// ============================================================
// 6. MCP 协议层
// ============================================================
console.log('\n[6] MCP 协议层');

test('initialize → 返回协议能力', () => {
  const srv = new MCPServer();
  const r = srv.handleInitialize('s1', {});
  assert.strictEqual(r.protocolVersion, '2025-03-26');
  assert.strictEqual(r.serverInfo.name, 'digital-collectibles-agent');
});

test('tools/list → 返回5个工具', () => {
  const srv = new MCPServer();
  const r = srv.handleListTools('s1');
  assert.strictEqual(r.tools.length, 5);
  const names = r.tools.map(t => t.name);
  assert.ok(names.includes('evaluate_project'));
  assert.ok(names.includes('check_portfolio'));
  assert.ok(names.includes('risk_alert'));
  assert.ok(names.includes('judge_elimination'));
  assert.ok(names.includes('track_health'));
});

test('tools/call 未知工具 → 报错', async () => {
  const srv = new MCPServer();
  const r = await srv.handleCallTool('s1', { name: 'nope', arguments: {} });
  assert.strictEqual(r.isError, true);
});

test('tools/call evaluate_project → JSON 输出', async () => {
  const srv = new MCPServer();
  const r = await srv.handleCallTool('s1', {
    name: 'evaluate_project',
    arguments: { name: '测试RWA', track: 'RWA', scarcity_score: 85, compliance_score: 90, liquidity_score: 80, consensus_score: 85, history_years: 5, holders: 20000, commercialization_count: 3, global_influence: true, founder_years: 5, retention_rate: 75 }
  });
  assert.strictEqual(r.isError, undefined);
  const parsed = JSON.parse(r.content[0].text);
  assert.strictEqual(parsed.step5_allocation.tier, 'core');
});

// ============================================================
// 总结
// ============================================================
console.log(`\n==========================`);
console.log(`结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 全部测试通过');
}
