# Contributing to FinMind AI

感谢你愿意参与 FinMind AI。这个项目目标是做一个开源、可运行、可扩展的金融分析 Agent Starter。

## 开发原则

1. **事实优先**：涉及财报、行情、指标时尽量保留来源、日期、单位和口径。
2. **不提供投资建议**：项目输出必须包含风险提示，避免“买入/卖出/保证收益”等表达。
3. **工具可替换**：Alpha Vantage、SEC EDGAR、PGVector、Ollama 都应通过配置替换。
4. **测试优先**：新增计算逻辑必须添加单元测试。

## 本地开发

```bash
cp .env.example .env
docker compose up -d postgres
ollama pull qwen2.5:7b
ollama pull mxbai-embed-large
mvn spring-boot:run
```

## 推荐贡献方向

- 增加更多市场数据源：Polygon、Tushare、AkShare、Wind/Choice 企业适配层。
- 增加财报解析：10-K、10-Q、年报 PDF、XBRL 表格抽取。
- 增加异常监控：价格跳变、量能放大、财报日、8-K、新闻事件。
- 增加评测集：财报问答、风险识别、指标计算准确率。
- 增加前端：React/Vue 仪表盘、Watchlist、报告生成器。

## Pull Request Checklist

- [ ] 通过 `mvn test`
- [ ] 没有提交 API Key、账号、客户数据
- [ ] README 或 docs 已更新
- [ ] 输出内容包含必要的金融风险提示
