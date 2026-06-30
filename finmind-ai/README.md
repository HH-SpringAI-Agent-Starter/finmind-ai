# FinMind AI：Spring AI 金融分析助手 Agent

FinMind AI 是一个可直接上传 GitHub 的开源项目骨架，用于学习和实战：

- Spring AI Agent / Tool Calling
- 金融数据查询工具接入
- SEC EDGAR 财报数据抓取与压缩摘要
- Alpha Vantage 行情查询
- 财报自动解读
- 市场异动监控
- PGVector + RAG 金融知识库
- 本地 Ollama 模型运行

> ⚠️ 免责声明：本项目仅用于技术学习、研究和演示，不构成投资建议、交易建议、证券推荐或财务顾问服务。真实投资决策请结合合规数据源、专业意见和自身风险承受能力。

---

## 1. 架构概览

```text
用户问题
  │
  ▼
REST API /api/agent/ask
  │
  ▼
Spring AI ChatClient Agent
  ├── financial_knowledge_search      # RAG 金融知识库检索
  ├── market_quote_lookup             # 行情快照查询
  ├── market_daily_series             # 历史日线查询
  ├── sec_company_lookup              # ticker -> CIK / 公司信息
  ├── sec_latest_filings              # 最新 10-K/10-Q/8-K 等披露
  ├── sec_company_facts_compact       # XBRL 关键指标压缩摘要
  ├── calculate_financial_ratio       # 财务指标计算
  └── detect_market_anomaly           # 市场异动检测
  │
  ├── Alpha Vantage API
  ├── SEC EDGAR API
  └── PGVector 金融知识库
```

---

## 2. 技术栈

- Java 21
- Spring Boot 4.1.x
- Spring AI 2.0.0
- Ollama：默认本地 LLM 与 Embedding
- PostgreSQL + PGVector：向量知识库
- Alpha Vantage：行情数据示例
- SEC EDGAR：美股上市公司披露数据

---

## 3. 快速开始

### 3.1 准备依赖

```bash
java -version      # 需要 21+
mvn -version
ollama --version
docker --version
```

### 3.2 启动向量库

```bash
docker compose up -d postgres
```

### 3.3 下载模型

```bash
ollama pull qwen2.5:7b
ollama pull mxbai-embed-large
```

### 3.4 配置环境变量

```bash
cp .env.example .env
```

建议修改：

```bash
ALPHA_VANTAGE_API_KEY=你的AlphaVantageKey
SEC_USER_AGENT=FinMindAI/0.1 your-email@example.com
```

> Alpha Vantage 的 `demo` key 只适合少量演示请求。SEC 自动访问建议设置可识别的 User-Agent。

### 3.5 启动项目

```bash
mvn spring-boot:run
```

---

## 4. API 示例

### 4.1 Agent 问答：财报自动解读

```bash
curl -s -X POST http://localhost:8080/api/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{
    "question":"请分析苹果公司最近财报的收入、利润、现金流和主要风险，并给出需要继续追踪的指标。",
    "ticker":"AAPL",
    "horizon":"3-6个月",
    "riskProfile":"稳健型"
  }' | jq
```

### 4.2 重新导入内置金融知识库

```bash
curl -X POST http://localhost:8080/api/knowledge/ingest | jq
```

### 4.3 市场异动监控

```bash
curl -s -X POST http://localhost:8080/api/market/anomaly \
  -H 'Content-Type: application/json' \
  -d '{
    "symbol":"IBM",
    "lookbackDays":20,
    "priceMoveThresholdPct":3.0,
    "volumeSpikeMultiplier":1.8
  }' | jq
```

---

## 5. Agent 能力设计

### 5.1 财报自动解读

Agent 会优先调用：

1. `sec_company_lookup`：解析 ticker 和 CIK。
2. `sec_latest_filings`：查看近期披露类型，例如 10-K、10-Q、8-K。
3. `sec_company_facts_compact`：抓取 SEC XBRL 的核心财务事实，压缩成收入、净利润、资产、负债、权益、经营现金流等关键项。
4. `calculate_financial_ratio`：计算同比、利润率、负债率、流动比率等。
5. `financial_knowledge_search`：补充财报阅读框架、风险提示和指标定义。

### 5.2 市场异动监控

Agent 或 `/api/market/anomaly` 会根据 Alpha Vantage 日线数据检查：

- 最新交易日涨跌幅是否超过阈值
- 成交量是否显著高于近期均量
- 是否需要结合 SEC 最新披露、财报日或新闻继续核查

### 5.3 RAG 金融知识库

内置知识位于：

```text
src/main/resources/knowledge/
```

你可以替换为自己的：

- 投研方法论
- 公司研究模板
- 行业指标手册
- 合规话术规则
- 财报解读 SOP
- 客户内部研究报告

---

## 6. 上传 GitHub

```bash
git init
git add .
git commit -m "Initial commit: FinMind AI Spring AI finance agent"

gh repo create finmind-ai --public --source=. --remote=origin --push
```

也可以手动在 GitHub 创建仓库后执行：

```bash
git remote add origin git@github.com:你的账号/finmind-ai.git
git branch -M main
git push -u origin main
```

---

## 7. Roadmap

- [ ] 接入 Polygon / Nasdaq Data Link / Tushare / AkShare
- [ ] 接入新闻与公告事件流
- [ ] 增加 Watchlist 定时监控任务
- [ ] 增加财报 PDF / 年报 HTML 解析
- [ ] 增加前端 Dashboard
- [ ] 增加 MCP Server，把行情和财报工具暴露给外部 Agent
- [ ] 增加多租户 SaaS 模式：用户、团队、项目、数据源隔离

---

## 8. 开源协议

Apache-2.0
