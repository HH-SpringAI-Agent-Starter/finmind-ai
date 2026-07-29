# finmind-ai — 股票/期货 Research OS

智能投研操作系统，将A股短线博弈 + 期货周期分析的知识体系封装为可执行Agent。

## 核心理念

- **数据→知识→Know-how→Workflow→Agent→SaaS**
- 真正值钱的是**可复制的决策流程(Decision Flow)**，不是Prompt
- 短线看动能，长线看价值 — 别拿价值投资的尺子量短线博弈

## 仓库结构

```
finmind-ai/
├── knowhow/
│   ├── nft/                  # 数字藏品Agent Know-how
│   └── stock-research-os/    # 股票/期货Research OS Know-how
│       ├── kh_stock_rules_001.md       # A: 业务规则
│       ├── kh_stock_decision_001.md    # B: 决策路径
│       └── kh_stock_failure_001.md     # C: 失败案例
├── src/
│   └── agents/
│       ├── digital-collectibles/       # 数字藏品Agent
│       └── stock-research-os/          # 股票/期货Research OS
│           ├── research_os_server.js   # D: MCP SSE Server
│           ├── signal_capture.js       # 信号捕获引擎
│           ├── se_framework.js         # S级判定框架
│           └── risk_monitor.js         # 风险监控引擎
├── tests/
│   └── stock-research-os/
└── README.md
```

## MCP Tools

通过 MCP SSE 协议暴露以下工具:

| Tool | 作用 | 输入 | 输出 |
|------|------|------|------|
| `capture_price_signal` | 捕获涨价信号并拆分 | 商品名+涨幅+来源 | 瓶颈定位+A股映射 |
| `assess_s_grade` | S级判定 | 标的+来源+逻辑 | S级分类+确定性 |
| `check_risk_signals` | 风险信号扫描 | 隔夜市场数据 | 🔴预警/减仓建议 |
| `daily_retrospect` | S级全回测 | S级池 | 逐只归因+退出建议 |
| `quarterly_analysis` | 四段式分析框架 | 行业/主题 | 期货端+A股梯队+速查表+风险 |
| `s2a_detection` | 底部横盘涨停检测 | 技术指标 | S2a信号+买点建议 |

## 启动

```bash
node src/agents/stock-research-os/research_os_server.js
```

Server 启动在 `http://localhost:3100/mcp` (SSE endpoint) 和 `http://localhost:3100/mcp-message`
