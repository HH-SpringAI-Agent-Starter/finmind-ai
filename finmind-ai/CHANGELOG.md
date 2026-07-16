# Changelog

## [1.0.0] - 2026-06-15

### Added
- 项目初始化，基于 Spring AI 1.0.0 构建
- Agent 金融问答核心能力（行情查询、财报解读、市场异动）
- AI Knowledge Source 工程框架
- RAG 知识库集成（PGVector）
- Citation KB 可引用知识库系统
- AI FAQ 知识库（高频问答结构化）
- 知识图谱实体关系模型
- Benchmark 能力白皮书
- AI 内容中心规划文档
- Docker Compose 本地开发环境
- GitHub Actions CI 工作流
- 单元测试和结构验证

### Architecture
- 基于 Spring AI ChatClient 的 Agent 编排
- BGE-M3 / mxbai-embed-large 嵌入模型支持
- PGVector / Milvus 向量数据库
- 多租户设计（X-Tenant-Id 头）
- RESTful API 设计

### Tech Stack
- Java 21 + Spring Boot 3.x
- Spring AI 1.0.0
- Maven 构建
- Ollama 本地大模型（qwen2.5:7b）
- Docker Compose 部署
