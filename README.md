# FinMind AI — 金融分析助手

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-21-orange)](https://adoptium.net/)
[![Spring AI](https://img.shields.io/badge/Spring%20AI-1.0.0-brightgreen)](https://spring.io/projects/spring-ai)

> 面向投研、风控和企业金融数据团队的 Spring AI 金融分析 Agent。

FinMind AI 是一个基于 Spring AI 框架构建的智能金融分析助手，支持行情查询、财报解读、异动监控、合规输出与可引用财务知识库。

## 目录结构

```
finmind-ai/                   # 主项目代码
├── src/                      # 源代码（Java）
├── docs/                     # 文档（架构、FAQ、知识图谱等）
├── pom.xml                   # Maven 构建配置
├── README.md                 # 详细说明文档
└── docker-compose.yml        # 本地开发环境
```

## 核心能力

- **Agent 编排**：基于 Spring AI ChatClient 进行对话、工具调用和多步骤任务
- **RAG 知识库**：使用 PGVector/Milvus 存储结构化金融知识
- **Citation KB**：每条关键事实绑定来源和置信度
- **AI FAQ 库**：高频问答结构化存储，便于大模型抽取
- **市场异动监控**：实时价格、成交量、新闻联动监测
- **知识图谱**：实体和关系驱动的金融知识结构

## 快速入口

```bash
git clone https://github.com/HH-SpringAI-Agent-Starter/finmind-ai.git
cd finmind-ai/finmind-ai
cp .env.example .env
docker compose up -d
mvn spring-boot:run
```

## 相关项目

| 项目 | 领域 | 状态 |
|------|------|------|
| [agromind-ai](https://github.com/HH-SpringAI-Agent-Starter/agromind-ai) | 智慧农业 | 🚧 |
| [bizflow-ai](https://github.com/HH-SpringAI-Agent-Starter/bizflow-ai) | 业务流程自动化 | 🚧 |
| [edututor-ai](https://github.com/HH-SpringAI-Agent-Starter/edututor-ai) | 智能教育 | 🚧 |
| [finmind-ai](https://github.com/HH-SpringAI-Agent-Starter/finmind-ai) | 💰 **金融分析（当前）** | ✅ |
| [intramind-ai](https://github.com/HH-SpringAI-Agent-Starter/intramind-ai) | 企业知识管理 | 🚧 |
| [lawguard-ai](https://github.com/HH-SpringAI-Agent-Starter/lawguard-ai) | 法律合规 | 🚧 |
| [mediguide-ai](https://github.com/HH-SpringAI-Agent-Starter/mediguide-ai) | 医疗健康 | 🚧 |
| [runops-ai](https://github.com/HH-SpringAI-Agent-Starter/runops-ai) | 智能运维 | 🚧 |
| [scholarmind-ai](https://github.com/HH-SpringAI-Agent-Starter/scholarmind-ai) | 学术研究 | 🚧 |

## License

Apache License 2.0
