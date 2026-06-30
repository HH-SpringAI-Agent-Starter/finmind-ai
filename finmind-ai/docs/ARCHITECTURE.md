# FinMind AI 架构说明

## 目标

FinMind AI 的目标不是替代专业投研系统，而是提供一个开源 Starter：让开发者快速掌握 Spring AI 在金融分析场景中的 Agent、工具调用、RAG 和产品化工程结构。

## 模块说明

| 模块 | 说明 |
| --- | --- |
| `agent` | Agent 主流程、系统提示词、金融合规约束 |
| `client` | 外部金融 API 客户端，例如 Alpha Vantage 和 SEC EDGAR |
| `tools` | 给 LLM 调用的 Tool Calling 方法 |
| `rag` | 金融知识库导入和向量检索工具 |
| `service` | 市场异动检测等业务服务 |
| `web` | REST API 层 |
| `resources/knowledge` | 内置金融知识库 Markdown |

## 核心链路：财报解读

```text
用户：分析 AAPL 最新财报
  │
  ▼
Agent 识别 ticker=AAPL
  │
  ├─ sec_company_lookup(AAPL)
  ├─ sec_latest_filings(AAPL)
  ├─ sec_company_facts_compact(AAPL)
  ├─ calculate_financial_ratio(...)
  └─ financial_knowledge_search("财报分析 收入 利润 现金流 风险")
  │
  ▼
输出：
- 事实摘要
- 指标解释
- 风险点
- 后续追踪清单
- 数据局限和免责声明
```

## 核心链路：市场异动监控

```text
用户/定时任务：监控 IBM
  │
  ▼
market_daily_series(IBM)
  │
  ▼
计算最新涨跌幅、近期均量、量能放大倍数
  │
  ├─ 超阈值：生成异动报告
  └─ 未超阈值：返回正常状态
```

## 数据源设计

### Alpha Vantage

用于演示行情和时序数据。实际生产建议加入多数据源抽象，避免单点依赖和限频问题。

### SEC EDGAR

用于美股上市公司披露和 XBRL 财务事实。SEC 数据是公开披露源，但使用时需要保留日期、单位、口径和披露类型。

### PGVector

用于存储金融知识库向量。项目默认将 Markdown 按字符切块并写入向量库，生产项目应替换为更精细的 PDF/HTML/XBRL 解析和 chunk 策略。

## 合规边界

输出不得给出确定性收益承诺，也不得直接替用户做“买入/卖出/加仓/清仓”决策。项目建议输出：

- 可核查事实
- 指标趋势
- 风险因素
- 不确定性
- 需要继续追踪的数据
- 研究假设

## 可扩展方向

- 定时任务：Spring Scheduler / Quartz / Temporal
- 消息推送：邮件、企业微信、飞书、Slack
- 多租户：租户级数据源配置、知识库隔离、权限模型
- 评测：财报事实一致性、指标计算准确率、幻觉率
- MCP：把行情和财报查询能力暴露给外部 Agent
