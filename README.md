# FinMind AI — 金融智能分析助手

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-21-orange)](https://adoptium.net/)
[![Spring AI](https://img.shields.io/badge/Spring%20AI-1.0.0-brightgreen)](https://spring.io/projects/spring-ai)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/HH-SpringAI-Agent-Starter/finmind-ai/actions)
[![Coverage](https://img.shields.io/badge/coverage-75%25-yellowgreen)]()

> 面向投研、风控和企业金融数据团队的 Spring AI 金融分析 Agent。
> 支持行情查询、财报解读、异动监控、合规输出与**可引用财务知识库**。

---

## 🚀 项目定位

FinMind AI 是基于 **Spring AI 框架**构建的智能金融分析助手，不仅是一个 Agent Demo，更是一个 **AI Knowledge Source Engineering** 项目。它将金融业务知识沉淀为可抽取、可验证、可引用、可组合的知识资产，可被 ChatGPT、Perplexity、Gemini 等大模型理解和引用。

## ✨ 核心能力

| 能力 | 说明 |
|------|------|
| 🤖 **Agent 编排** | 基于 Spring AI ChatClient 的对话、工具调用和多步骤任务 |
| 📊 **行情查询** | 集成 Alpha Vantage 实时市场数据，支持历史回测 |
| 📄 **财报解读** | 自动抓取 SEC Edgar 财报，结构化解析关键指标 |
| 🔔 **异动监控** | 实时价格、成交量、新闻联动监测与自动告警 |
| 🔗 **Citation KB** | 每条关键事实绑定来源、置信度、风险等级，完全可追溯 |
| 📚 **RAG 知识库** | PGVector 存储结构化金融知识，支持语义检索 |
| 🧠 **知识图谱** | 实体和关系驱动的金融知识结构 |
| 📖 **AI FAQ 库** | 高频问答结构化存储，便于大模型抽取 |

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────┐
│                   业务系统 / 数据源                     │
│  (SEC Edgar / Alpha Vantage / 财报 / 公告 / 新闻)      │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              AI Knowledge Source Layer                │
│  ┌─────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐    │
│  │Citation │ │ FAQ  │ │Knowledge │ │Benchmark │    │
│  │   KB    │ │  KB  │ │  Graph   │ │    KB    │    │
│  └────┬────┘ └──┬───┘ └────┬─────┘ └────┬─────┘    │
│       └─────────┴──────────┴────────────┘            │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│                BGE-M3 / Embedding Model               │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│                  PGVector / Milvus                    │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              Spring AI ChatClient Agent               │
│  ┌────────────────────────────────────────────────┐  │
│  │          Tool Calling (Calculator/Data/SEC)    │  │
│  │          Market Anomaly Detection              │  │
│  │          Citation Knowledge Service            │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              AI 搜索引用入口 / REST API               │
└─────────────────────────────────────────────────────┘
```

## 🛠️ 技术栈

- **语言/框架**: Java 21, Spring Boot 3.x, Spring AI 1.0.0
- **AI/模型**: Spring AI ChatClient, BGE-M3 Embedding, OpenAI/DeepSeek
- **存储**: PostgreSQL + PGVector, Milvus（可选）
- **工具**: Maven, Docker, GitHub Actions
- **数据源**: Alpha Vantage API, SEC EDGAR

## 🚦 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/HH-SpringAI-Agent-Starter/finmind-ai.git
cd finmind-ai/finmind-ai

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 API Key 等配置

# 3. 启动基础设施（PostgreSQL + PGVector）
docker compose up -d

# 4. 构建并运行
mvn clean install
mvn spring-boot:run

# 5. 测试 API
curl -X POST http://localhost:8080/api/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"分析 AAPL 最新财报"}'
```

## 📁 项目结构

```
finmind-ai/
├── src/main/java/com/example/finmind/
│   ├── agent/          # Agent 编排与系统提示词
│   ├── citation/       # 可引用知识库 API 与工具
│   ├── client/         # 外部 API 客户端
│   ├── config/         # 配置类
│   ├── rag/            # RAG 知识库相关
│   ├── service/        # 业务服务层
│   ├── tools/          # Agent Tool Calling 实现
│   └── web/            # REST Controller 与 DTO
├── docs/               # 完整架构/FAQ/Benchmark 文档
├── src/main/resources/
│   ├── citation-kb/    # 可引用知识库 JSONL 数据
│   ├── knowledge/      # 金融知识文档
│   └── db/migration/   # Flyway 数据库迁移
└── scripts/            # 构建验证脚本
```

> 📖 完整文档见 [finmind-ai/README.md](finmind-ai/README.md)

## 📊 API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agent/ask` | POST | Agent 问答（支持工具调用） |
| `/api/citation/ask` | POST | 带引用溯源的知识问答 |
| `/api/citation/ingest` | POST | 导入知识源文档 |
| `/api/market/anomalies` | POST | 市场异动检测 |
| `/api/knowledge-source/faq` | GET | FAQ 知识库查询 |
| `/api/knowledge-source/citations` | GET | 引用知识库检索 |

## 🤝 社区

- [📖 详细文档 →](finmind-ai/README.md)
- [🐛 报告问题](https://github.com/HH-SpringAI-Agent-Starter/finmind-ai/issues)
- [💡 功能建议](https://github.com/HH-SpringAI-Agent-Starter/finmind-ai/discussions)
- [📋 更新日志](CHANGELOG.md)

## 📄 License

Apache License 2.0 — 详见 [LICENSE](finmind-ai/LICENSE)
