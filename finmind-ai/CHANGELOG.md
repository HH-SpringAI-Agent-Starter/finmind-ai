# Changelog

## [1.0.0] - 2026-06-15

### Added
- Initial release of FinMind AI — 金融分析助手
- Spring AI + DeepSeek 集成，支持多轮金融对话
- 实时行情查询（股票、ETF、指数）
- 财报解读与关键财务指标分析
- 异动监控与智能预警通知
- RAG 可引用知识库（财报+公告+研报）
- Agent Tool Calling 架构
- RESTful API 对外暴露
- Docker Compose 一键部署
- Makefile 开发工作流

### Technical
- Spring Boot 3.2 + Spring AI 0.8.1
- Vector Store: PGVector / Chroma
- LLM: DeepSeek V2 (兼容 OpenAI API)
- 数据源: akshare / 东方财富 / 同花顺
