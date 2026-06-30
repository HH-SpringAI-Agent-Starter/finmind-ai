# SEC 披露分析要点

SEC EDGAR 提供上市公司提交的披露文件和 XBRL 数据。分析时必须保留表单类型、披露日期、报告期和单位。

## 常见表单

- 10-K：年度报告，包含业务、风险、MD&A、财务报表和审计意见。
- 10-Q：季度报告，覆盖季度经营和财务变化。
- 8-K：重大事件披露，例如并购、管理层变动、业绩预告、重大合同、诉讼等。
- DEF 14A：代理声明，常用于治理、薪酬和股东投票分析。

## XBRL companyfacts 使用注意

- 同一个指标可能有多个 US-GAAP tag，例如 Revenue 与 RevenueFromContractWithCustomerExcludingAssessedTax。
- 必须区分 FY、Q1/Q2/Q3/Q4、TTM 和 frame。
- 必须检查单位，例如 USD、shares、USD/shares。
- 最新 filed date 不一定代表最新报告期，需要结合 end、fy、fp 和 form。

## Agent 输出要求

Agent 应说明：“以下数据来自 SEC EDGAR XBRL 抽取，可能存在标签口径差异，请以原始 filing 为准。”
