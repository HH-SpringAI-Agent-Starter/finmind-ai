/**
 * 数字藏品价值投资 Agent — Decision Flow 第2块 测试
 * 覆盖: 问题分类 / 生存证据 / 平台关停(D) / 一级MINT(E) / 抵押清算(F) / 回撤归因 / 加仓审批 / 综合路由
 * 运行: node tests/digital-collectibles/test_flow_nft_002.js
 */

const assert = require('assert');
const { NFTDecisionFlow } = require('../../src/agents/digital-collectibles/flow_nft_002.js');

const flow = new NFTDecisionFlow();

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

console.log('\n🧪 数字藏品Agent · Decision Flow 第2块 测试套件');
console.log('===============================================');

// ============================================================
// 1. classifyQuestion — 问题分类(第0步)
// ============================================================
console.log('\n[1] classifyQuestion — 问题分类路由');

test('buy → 买入决策流', () => {
  const r = flow.classifyQuestion('buy');
  assert.strictEqual(r.route, 'buy');
  assert.ok(r.label.includes('买入'));
});

test('today_pick → 直接拒绝', () => {
  const r = flow.classifyQuestion('today_pick');
  assert.strictEqual(r.route, 'reject');
});

test('platform/mint/loan → 三条新增子流', () => {
  assert.strictEqual(flow.classifyQuestion('platform').route, 'platform');
  assert.strictEqual(flow.classifyQuestion('mint').route, 'mint');
  assert.strictEqual(flow.classifyQuestion('loan').route, 'loan');
});

test('未知类型 → 需人工确认(不默认放行)', () => {
  const r = flow.classifyQuestion('什么都能涨吗');
  assert.strictEqual(r.route, 'unknown');
});

// ============================================================
// 2. evaluateSurvival — 生存证据(买入第1关)
// ============================================================
console.log('\n[2] evaluateSurvival — 生存证据(求活不求涨)');

test('0/4项 → 拒买', () => {
  const r = flow.evaluateSurvival({});
  assert.strictEqual(r.passed_count, 0);
  assert.ok(r.decision.includes('拒买'));
});

test('1/4项 → 拒买(可能只是"看起来蓝筹")', () => {
  const r = flow.evaluateSurvival({ survived_cycle: true });
  assert.strictEqual(r.passed_count, 1);
  assert.ok(r.decision.includes('拒买'));
});

test('2/4项 → 通过, 进入评分体系', () => {
  const r = flow.evaluateSurvival({ survived_cycle: true, commercialization_ge_3: true });
  assert.strictEqual(r.passed_count, 2);
  assert.ok(r.decision.includes('通过'));
  assert.ok(r.reason.includes('评分'));
});

test('4/4项 → 通过', () => {
  const r = flow.evaluateSurvival({ survived_cycle: true, commercialization_ge_3: true, team_active: true, retention_ge_70: true });
  assert.strictEqual(r.passed_count, 4);
  assert.ok(r.decision.includes('通过'));
});

// ============================================================
// 3. checkPlatformShutdown — 平台关停(失败案例D)
// ============================================================
console.log('\n[3] checkPlatformShutdown — 通道风险分诊');

test('平台托管+已公告清退+无承诺 → 归零处理+禁止抄底', () => {
  const r = flow.checkPlatformShutdown({ custody: 'platform', shutdown_announced: true });
  assert.strictEqual(r.risk, '高');
  assert.ok(r.actions.some(a => a.includes('归零')));
  assert.ok(r.actions.some(a => a.includes('尽快提出')));
  assert.ok(r.actions.some(a => a.includes('禁止抄底补仓')));
});

test('平台托管+有回购承诺 → 按承诺退款但设最坏预期', () => {
  const r = flow.checkPlatformShutdown({ custody: 'platform', buyback_commitment: true, shutdown_announced: true });
  assert.ok(r.actions.some(a => a.includes('回购')));
  assert.ok(r.actions.some(a => a.includes('最坏预期')));
});

test('平台托管+仅暴雷传闻 → 先降仓位不入场', () => {
  const r = flow.checkPlatformShutdown({ custody: 'platform', shutdown_rumor: true });
  assert.ok(r.actions.some(a => a.includes('降低仓位')));
});

test('自持私钥 → 中风险(链上还在)', () => {
  const r = flow.checkPlatformShutdown({ custody: 'self', shutdown_announced: true });
  assert.strictEqual(r.risk, '中');
  assert.ok(r.reason.includes('交易入口'));
});

// ============================================================
// 4. checkMint — 一级MINT破发(失败案例E)
// ============================================================
console.log('\n[4] checkMint — 一级MINT分诊');

test('发行价>地板×2 → 不参与白名单', () => {
  const r = flow.checkMint({ mint_price_vs_floor: 2.5 });
  assert.ok(r.decision.includes('不参与白名单'));
  assert.ok(r.reason.includes('透支预期'));
});

test('抢到后开盘破发 → 立即止损, 不等反弹', () => {
  const r = flow.checkMint({ mint_price_vs_floor: 1.2, open_above_mint: false });
  assert.ok(r.decision.includes('立即止损'));
  assert.ok(r.action.includes('不幻想'));
});

test('开盘溢价+发行价合理 → 可持有候选, 仍要走买入流', () => {
  const r = flow.checkMint({ mint_price_vs_floor: 1.0, open_above_mint: true });
  assert.ok(r.decision.includes('可持有'));
  assert.ok(r.action.includes('买入决策流'));
});

// ============================================================
// 5. checkLoanClearing — 抵押清算螺旋(失败案例F)
// ============================================================
console.log('\n[5] checkLoanClearing — 杠杆清算分诊');

test('借款用途=加仓 → 拒绝(死亡螺旋燃料)', () => {
  const r = flow.checkLoanClearing({ loan_purpose: 'add_position' });
  assert.ok(r.decision.includes('拒绝'));
  assert.ok(r.reason.includes('死亡螺旋'));
});

test('周转+距清算线20% → 极高危', () => {
  const r = flow.checkLoanClearing({ loan_purpose: 'liquidity', distance_to_liquidation_pct: 20 });
  assert.ok(r.decision.includes('极高危'));
});

test('周转+距清算线60%+流动性好+ltv40 → 勉强可评估', () => {
  const r = flow.checkLoanClearing({ loan_purpose: 'liquidity', distance_to_liquidation_pct: 60, ltv_pct: 40, liquid_market: true });
  assert.ok(r.decision.includes('勉强可评估'));
});

test('周转+ltv70 → 拒绝(杠杆过高)', () => {
  const r = flow.checkLoanClearing({ loan_purpose: 'liquidity', distance_to_liquidation_pct: 60, ltv_pct: 70, liquid_market: true });
  assert.ok(r.decision.includes('拒绝'));
});

test('周转+缓冲不足+流动性差 → 高危', () => {
  const r = flow.checkLoanClearing({ loan_purpose: 'liquidity', distance_to_liquidation_pct: 40, ltv_pct: 30, liquid_market: false });
  assert.ok(r.decision.includes('高危'));
});

// ============================================================
// 6. drawdownAttribution — 打折还是逻辑失效
// ============================================================
console.log('\n[6] drawdownAttribution — 回撤归因(专家分水岭)');

test('未触发(小跌) → 正常监控', () => {
  const r = flow.drawdownAttribution({ drawdown_pct: -10, retention_rate: 85 });
  assert.strictEqual(r.trigger, false);
  assert.ok(r.decision.includes('正常监控'));
});

test('-55%但核心逻辑全好 → 持有观察, 不恐慌不自动卖', () => {
  const r = flow.drawdownAttribution({ drawdown_pct: -55, retention_rate: 80, volume_change_pct: -20, monthly_buy_vs_sell: 'buy_gt_sell', team_status: 'active' });
  assert.strictEqual(r.trigger, true);
  assert.strictEqual(r.bad_signals.length, 0);
  assert.ok(r.decision.includes('持有观察'));
});

test('-55% + 留存崩 + 团队跑路 → 逻辑失效淘汰', () => {
  const r = flow.drawdownAttribution({ drawdown_pct: -55, retention_rate: 45, team_status: 'vanished' });
  assert.ok(r.decision.includes('逻辑失效'));
  assert.ok(r.bad_signals.length >= 2);
  assert.ok(r.action.includes('倒金字塔'));
});

test('停更95天(未大跌) → 也触发深度分析', () => {
  const r = flow.drawdownAttribution({ drawdown_pct: -5, days_since_update: 95, retention_rate: 80 });
  assert.strictEqual(r.trigger, true);
  assert.ok(r.decision.includes('持有观察'));
});

test('投机者涌入 → 死亡螺旋前兆信号', () => {
  const r = flow.drawdownAttribution({ drawdown_pct: -60, user_growth_source: 'speculator', retention_rate: 72 });
  assert.ok(r.bad_signals.some(s => s.includes('投机者')));
});

// ============================================================
// 7. approveAddPosition — 加仓审批
// ============================================================
console.log('\n[7] approveAddPosition — 加仓审批(无快捷通道)');

test('逻辑失效 → 禁止加仓(倒金字塔病根)', () => {
  const r = flow.approveAddPosition({ logic_ok: false });
  assert.ok(r.decision.includes('禁止加仓'));
});

test('仓位≥10% → 先再平衡', () => {
  const r = flow.approveAddPosition({ logic_ok: true, position_pct: 15 });
  assert.ok(r.decision.includes('先再平衡'));
});

test('生存证据不足 → 拒绝加仓', () => {
  const r = flow.approveAddPosition({ logic_ok: true, position_pct: 5, survival: { survived_cycle: true } });
  assert.ok(r.decision.includes('拒绝加仓'));
});

test('全部通过 → 走完整买入流(不是直接同意)', () => {
  const r = flow.approveAddPosition({
    logic_ok: true, position_pct: 5,
    survival: { survived_cycle: true, commercialization_ge_3: true, team_active: true, retention_ge_70: true }
  });
  assert.ok(r.decision.includes('走完整买入流'));
});

// ============================================================
// 8. resolve — 综合路由总入口
// ============================================================
console.log('\n[8] resolve — 综合路由总入口');

test('today_pick → 拒绝回答', () => {
  const r = flow.resolve({ question_type: 'today_pick' });
  assert.strictEqual(r.triage, '❌ 直接拒绝');
  assert.ok(r.decision.includes('拒绝回答'));
});

test('platform 场景 → 路由到通道风险分诊', () => {
  const r = flow.resolve({ question_type: 'platform', custody: 'platform', shutdown_announced: true });
  assert.ok(r.triage.includes('平台关停'));
  assert.strictEqual(r.risk, '高');
  assert.ok(r.actions.some(a => a.includes('尽快提出')));
});

test('loan 场景 → 拒绝加杠杆', () => {
  const r = flow.resolve({ question_type: 'loan', loan_purpose: 'add_position' });
  assert.ok(r.triage.includes('抵押清算'));
  assert.ok(r.decision.includes('拒绝'));
});

test('buy 场景生存证据不足 → 拒买', () => {
  const r = flow.resolve({ question_type: 'buy', survival: { survived_cycle: true } });
  assert.ok(r.decision.includes('拒买'));
});

test('buy 场景生存证据达标 → 进入评分体系', () => {
  const r = flow.resolve({ question_type: 'buy', survival: { survived_cycle: true, commercialization_ge_3: true, team_active: true } });
  assert.ok(r.decision.includes('进入评分体系'));
});

test('mint 场景破发 → 立即止损', () => {
  const r = flow.resolve({ question_type: 'mint', mint_price_vs_floor: 1.1, open_above_mint: false });
  assert.ok(r.triage.includes('一级MINT'));
  assert.ok(r.decision.includes('立即止损'));
});

test('未知类型 → 需人工确认', () => {
  const r = flow.resolve({ question_type: '随便聊聊' });
  assert.ok(r.decision.includes('需人工确认'));
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