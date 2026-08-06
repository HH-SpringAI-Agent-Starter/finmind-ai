# FinMind AI — 功能需求文档

## 1. 项目概述

### 1.1 定位
面向投研、风控和企业金融数据团队的 Spring AI 金融分析 Agent。

### 1.2 核心理念
金融答案必须区分事实、估算和观点，并能追溯到财报、公告、行情和监管来源。

## 2. 功能需求

### FR-1: 金融 Agent 问答
- 用户向 Agent 提问金融相关问题，Agent 调用工具获取数据
- 返回带引用来源的回答，支持多轮对话

### FR-2: 工具调用
- 实时行情查询（股票、ETF、指数）
- 财报数据解读（收入、利润、现金流）
- 市场异动监控（价格+成交量+新闻联动）
- 行业板块分析

### FR-3: RAG 知识库
- 存储结构化金融知识，支持语义检索
- 元数据过滤（来源、日期、置信度、风险等级）

### FR-4: Citation KB
- 每条关键事实绑定 source / source_url / publish_date / confidence
- 支持 risk_level 标注（low / medium / high）
- 可被大模型直接引用

### FR-5: AI FAQ 库
- Question → Answer 结构化存储，分类标签体系
- 便于大模型抽取和验证

### FR-6: 知识图谱
- 实体（公司、指标、概念、行业）和关系定义
- 图查询和检索 API

### FR-7: 多租户
- 通过 X-Tenant-Id 头隔离，租户级知识库

## 3. 非功能需求

### NFR-1: 性能
- 问答响应时间 < 5 秒（本地模型）
- 知识检索 < 1 秒

### NFR-2: 可扩展性
- 工具可替换（数据源、模型、向量库）
- 插件化工具注册

### NFR-3: 安全合规
- 不提供投资建议（强制风险提示）
- 来源可追溯，支持审计日志

## 4. 系统架构

```
用户 / API → Spring AI ChatClient → Agent Orchestrator
                                         │
                  ┌──────────────────────┼──────────────────────┐
                  ▼                      ▼                      ▼
             Tool Calling          RAG 知识库            Citation KB
                  │                      │                      │
                  ▼                      ▼                      ▼
          行情API/财报数据         PGVector/Milvus        可引用事实库
```

### 数据流
1. 用户提问 → ChatClient 接收
2. Agent 分析意图 → 选择工具或知识库
3. 工具执行 → 调用外部数据源
4. 知识检索 → RAG 获取相关片段
5. 合成回答 → LLM 生成带引用回答
6. 返回 → 用户收到结构化答案

## 5. 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | Java 21 |
| 框架 | Spring Boot 3.x + Spring AI 1.0.0 |
| 构建 | Maven |
| 向量数据库 | PGVector / Milvus |
| 嵌入模型 | BGE-M3 / mxbai-embed-large |
| 大模型 | Ollama (qwen2.5:7b) |
| 部署 | Docker Compose |
| 数据库 | PostgreSQL + PGVector 插件 |

## 6. API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/agent/ask | POST | Agent 金融问答 |
| /api/knowledge-source/faq | GET | FAQ 知识库 |
| /api/knowledge-source/citations | GET | 引用知识检索 |
| /api/knowledge-source/benchmark | GET | Benchmark 白皮书 |
| /api/knowledge-source/graph/relations | GET | 知识图谱关系 |

## 7. 数据模型

### Citation Fact
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| source | String | 来源名称（如 SEC EDGAR） |
| source_url | String | 来源链接 |
| publish_date | String | 发布日期 |
| confidence | Float | 置信度 0-1 |
| risk_level | String | low/medium/high |

### RAG Document Metadata
| 字段 | 类型 | 说明 |
|------|------|------|
| doc_key | String | 文档唯一键 |
| title | String | 标题 |
| summary | String | 摘要 |
| keywords | String[] | 关键词 |
| source_keys | String[] | 来源标识 |
| citable | Boolean | 是否可引用 |
| composable_tags | String[] | 组合标签 |
