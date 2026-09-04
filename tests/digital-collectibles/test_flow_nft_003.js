/**
 * 数字藏品价值投资 Agent — Decision Flow 第3块测试
 * 覆盖: 单资产10%铁律 / 组合配比护栏 / 单持仓P0-P2扫描 / 批量扫描排序 / 分批退出执行计划 / 数据缺失保守处理
 * 运行: node tests/digital-collectibles/test_flow_nft_003.js
 */

const assert = require('assert');
const { NFTPortfolioManager } = require('../../src/agents/digital-collectibles/flow_nft_003.js');

const mgr = new NFTPortfolioManager();

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

console.log('\n📦 数字藏品Agent · 组合仓位管理/批量扫描层(第3块) 测试套件');
console.log('===============================================');

// ============================================================
// 1. checkSingleAssetCap — 10% 铁律
// ============================================================
console.log('\n[1] checkSingleAssetCap — 单资产10%铁律');

test('12% 超配 → 强制减仓, 超额2%', () => {
  const r = mgr.checkSingleAssetCap({ asset: 'BAYC', pct: 12, portfolio_value: 100000 });
  assert.strictEqual(r.over, true);
  assert.strictEqual(r.priority, 'P1');
  assert.strictEqual(r.excess_pct, 2);
  assert.strictEqual(r.excess_value, 2000);
  assert.ok(r.decision.includes('强制减仓'));
});

test('8% 合规 → 不动作', () => {
  const r = mgr.checkSingleAssetCap({ asset: 'RWA债', pct: 8 });
  assert.strictEqual(r.over, false);
  assert.ok(r.decision.includes('合规'));
  assert.strictEqual(r.priority, null);
});

// ============================================================
// 2. checkAllocation — 核心60/成长30/观察10 护栏
// ============================================================
console.log('\n[2] checkAllocation — 组合配比护栏');

test('60/30/10 → 合规', () => {
  const r = mgr.checkAllocation({ core_pct: 60, growth_pct: 30, watch_pct: 10 });
  assert.strictEqual(r.compliant, true);
  assert.strictEqual(r.priority, null);
});

test('观察仓18% 超限 → P1 强制降回10%', () => {
  const r = mgr.checkAllocation({ core_pct: 52, growth_pct: 30, watch_pct: 18 });
  assert.strictEqual(r.compliant, false);
  assert.strictEqual(r.priority, 'P1');
  assert.ok(r.issues.some(i => i.label === '观察仓超限'));
});

test('成长仓45% → P1 强制再平衡', () => {
  const r = mgr.checkAllocation({ core_pct: 45, growth_pct: 45, watch_pct: 10 });
  assert.strictEqual(r.priority, 'P1');
  assert.ok(r.issues.some(i => i.label === '成长仓超配'));
});

test('核心仓45%+成长仓42% → P2检视 + P1再平衡', () => {
  const r = mgr.checkAllocation({ core_pct: 45, growth_pct: 42, watch_pct: 15 });
  const labels = r.issues.map(i => i.label);
  assert.ok(labels.includes('核心仓跌破护栏'));
  assert.ok(labels.includes('成长仓超配'));
  assert.strictEqual(r.priority, 'P1');
});

// ============================================================
// 3. scanHolding — 单持仓 P0/P1/P2 信号
// ============================================================
console.log('\n[3] scanHolding — 单持仓扫描');

test('平台托管+已公告清退 → P0 尽快提现(失败案例D)', () => {
  const r = mgr.scanHolding({ name: '某数藏平台藏品', custody: 'platform', shutdown_announced: true });
  assert.strictEqual(r.priority, 'P0');
  assert.ok(r.decision.includes('P0'));
  assert.ok(r.signals.some(s => s.key === 'platform_shutdown'));
  assert.ok(r.action.includes('提现'));
});

test('抵押贷款+距清算线25% → P0 降杠杆(失败案例F)', () => {
  const r = mgr.scanHolding({ name: 'BAYC抵押单', custody: 'self', is_loan: true, liq_buffer: 25 });
  assert.strictEqual(r.priority, 'P0');
  assert.ok(r.signals.some(s => s.key === 'liquidation_spiral'));
});

test('地板价-60%+留存率65%+团队隐身 → P1 深度归因→淘汰', () => {
  const r = mgr.scanHolding({
    name: '蓝筹PFP', floor_change_pct: -60, retention_pct: 65,
    volume_change_pct: -55, team_active: false, stop_update_days: 120
  });
  assert.strictEqual(r.priority, 'P1');
  assert.ok(r.signals.some(s => s.key === 'floor_crash'));
  assert.ok(r.signals.some(s => s.key === 'retention_broken'));
  assert.ok(r.signals.some(s => s.key === 'team_inactive'));
  assert.ok(r.action.includes('淘汰'));
});

test('地板价-60%但核心逻辑健康 → P1深度归因→持有观察(不恐慌卖出)', () => {
  const r = mgr.scanHolding({
    name: 'RWA龙头', floor_change_pct: -60, retention_pct: 85,
    volume_change_pct: -20, team_active: true, stop_update_days: 15
  });
  assert.strictEqual(r.priority, 'P1');
  assert.ok(r.action.includes('持有观察'));
});

test('仅停更95天 → P2 黄警观察', () => {
  const r = mgr.scanHolding({ name: '普通藏品', stop_update_days: 95 });
  assert.strictEqual(r.priority, 'P2');
  assert.ok(r.signals.some(s => s.key === 'stop_update'));
  assert.strictEqual(r.next_review_days, 30);
});

test('全部健康 → 持有', () => {
  const r = mgr.scanHolding({
    name: '健康持仓', retention_pct: 80, volume_change_pct: -10,
    team_active: true, stop_update_days: 10, month_buy: 30, month_sell: 10
  });
  assert.strictEqual(r.priority, null);
  assert.ok(r.decision.includes('持有'));
});

test('成交量/留存率数据缺失 → P2 保守黄警', () => {
  const r = mgr.scanHolding({ name: '无数据项目' });
  assert.strictEqual(r.priority, 'P2');
  assert.ok(r.signals.some(s => s.key === 'data_missing'));
});

// ============================================================
// 4. scanPortfolio — 批量扫描 + 优先级排序
// ============================================================
console.log('\n[4] scanPortfolio — 批量扫描排序');

test('P0排最前, 统计正确', () => {
  const r = mgr.scanPortfolio([
    { name: 'A健康', retention_pct: 80, volume_change_pct: -5, stop_update_days: 5 },
    { name: 'B平台关停', custody: 'platform', shutdown_announced: true },
    { name: 'C停更', stop_update_days: 100 }
  ]);
  assert.strictEqual(r.items[0].name, 'B平台关停');
  assert.strictEqual(r.items[0].priority, 'P0');
  assert.strictEqual(r.counts.P0, 1);
  assert.strictEqual(r.counts.P1, 0);
  assert.strictEqual(r.counts.P2, 1);
  assert.strictEqual(r.counts.hold, 1);
  assert.ok(r.summary.includes('共 3 笔持仓'));
});

// ============================================================
// 5. buildExitPlan — 退出执行计划
// ============================================================
console.log('\n[5] buildExitPlan — 退出执行计划');

test('P0平台关停 → 单笔100%立即,不分批', () => {
  const r = mgr.buildExitPlan({ priority: 'P0', reason: '平台关停' });
  assert.strictEqual(r.batches.length, 1);
  assert.strictEqual(r.batches[0].pct, 100);
  assert.ok(r.batches[0].deadline.includes('立即'));
});

test('P0清算螺旋 → 立即还贷/补保证金', () => {
  const r = mgr.buildExitPlan({ priority: 'P0', reason: '清算螺旋高危' });
  assert.strictEqual(r.batches[0].pct, 100);
  assert.ok(r.batches[0].method.includes('还贷'));
});

test('P1逻辑失效 → 50/30/20 三批 + 价格/量护栏', () => {
  const r = mgr.buildExitPlan({ priority: 'P1', reason: '逻辑失效', floor_price: 1.0, daily_volume: 100, position_value: 10000 });
  assert.strictEqual(r.batches.length, 3);
  assert.deepStrictEqual(r.batches.map(b => b.pct), [50, 30, 20]);
  assert.ok(r.guards.some(g => g.includes('挂单价')));
  assert.ok(r.guards.some(g => g.includes('等反弹')));
});

test('P2观察 → 不动作, 30天复查', () => {
  const r = mgr.buildExitPlan({ priority: 'P2', reason: '停更黄警' });
  assert.strictEqual(r.batches.length, 0);
  assert.strictEqual(r.next_review_days, 30);
});

test('未知优先级 → 需人工确认, 禁止默认放行', () => {
  const r = mgr.buildExitPlan({ priority: 'X', reason: '?' });
  assert.strictEqual(r.priority, 'UNKNOWN');
  assert.ok(r.note.includes('人工确认'));
});

// ============================================================
// 6. run — 组合层总入口
// ============================================================
console.log('\n[6] run — 组合层总入口');

test('配比+扫描+退出计划一次输出', () => {
  const r = mgr.run({
    holdings: [
      { name: '平台藏品', custody: 'platform', shutdown_announced: true },
      { name: '健康持仓', retention_pct: 82, volume_change_pct: -8 }
    ],
    allocation: { core_pct: 60, growth_pct: 30, watch_pct: 10 },
    exit_focus: { priority: 'P0', reason: '平台关停' }
  });
  assert.strictEqual(r.allocation.compliant, true);
  assert.strictEqual(r.scans.counts.P0, 1);
  assert.strictEqual(r.exits.batches[0].pct, 100);
});

// ============================================================
// 汇总
// ============================================================
console.log('\n===============================================');
console.log(`结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
console.log('🎉 组合仓位管理/批量扫描层 测试全部通过');