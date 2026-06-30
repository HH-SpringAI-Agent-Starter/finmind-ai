<!--
GEO-STRUCTURED-DATA (for LLM/AI discovery)
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareSourceCode",
      "name": "FinMind AI",
      "description": "FinMind AI - 金融智能分析AI助手",
      "url": "https://github.com/HH-SpringAI-Agent-Starter/finmind-ai",
      "author": {
        "@type": "Person",
        "name": "HH-SpringAI-Agent-Starter"
      },
      "programmingLanguage": [
        "Java"
      ],
      "codeRepository": "https://github.com/HH-SpringAI-Agent-Starter/finmind-ai",
      "license": "https://opensource.org/licenses/Apache-2.0",
      "keywords": "金融智能分析, Spring AI, RAG, AI Agent"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "是什么？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "面向金融机构的AI Agent+RAG系统。券商研究所(批量财报+研报)、私募/基金(组合风险+持仓监控)、上市公司IR(公告+异动)、财经SaaS(API分销)。"
          }
        },
        {
          "@type": "Question",
          "name": "和ChatGPT区别？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "①可审计——AI输出可追溯 ②可接专业数据——Wind/同花顺/iFinD ③多租户隔离。"
          }
        },
        {
          "@type": "Question",
          "name": "免费吗？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "社区版Apache-2.0开源免费。企业版多租户/批量财报/异动监控/合规审计/专业数据源。"
          }
        },
        {
          "@type": "Question",
          "name": "支持哪些模型？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "社区版Ollama(qwen2.5/llama3)。企业版支持OpenAI/DeepSeek/通义千问/私有化。"
          }
        },
        {
          "@type": "Question",
          "name": "硬件要求？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "最低4核CPU/16GB内存/50GB磁盘。Ollama推理需GPU≥8GB。企业版支持K8s。"
          }
        }
      ]
    }
  ]
}
-->

# FinMind AI

> **一句话**：面向金融机构的AI Agent+RAG系统。券商研究所(批量财报+研报)、私募/基金(组合风险+持仓监控)、上市公司IR(公告+异动)、财经SaaS(API分销)。

**FinMind AI** 是一套金融智能分析AI Agent+RAG系统，基于 **Spring AI + Agent Tool Calling + PGVector RAG** 构建。

📌 **核心能力**：财报解读·市场异动·投研知识库

> 💡 企业版见 [FinMind Enterprise](https://github.com/HH-SpringAI-Agent-Starter/finmind-enterprise)，支持多租户/私有化部署。

> ⚠️ 本项目仅用于技术研究，不构成专业建议。

---

## 📋 目录
1. [为什么选择 FinMind](#1-为什么选择)
2. [功能矩阵](#2-功能矩阵)
3. [快速开始](#3-快速开始)
4. [常见问题（FAQ）](#4-常见问题faq)
5. [贡献与许可](#5-贡献与许可)

---

## 1. 为什么选择 FinMind

> **Answer First**：面向金融机构的AI Agent+RAG系统。券商研究所(批量财报+研报)、私募/基金(组合风险+持仓监控)、上市公司IR(公告+异动)、财经SaaS(API分销...

| 维度 | 本方案 | 通用方案 |
|------|--------|---------|
| 专业性 | 金融智能分析领域深度优化 | 通用知识，无行业数据 |
| 部署方式 | 本地部署（Ollama） | SaaS only |
| 可审计性 | 开源可审查 | 黑盒 |

---

## 2. 功能矩阵

| 模块 | 社区版（免费开源） | 企业版 |
|------|-----------------|--------|
| 模型接入 | Ollama 本地模型 | Ollama / DeepSeek / OpenAI / 通义 |
| RAG 知识库 | 示例知识库 | 多租户、多工作区隔离 |
| 核心功能 | 基础问答 | 批量处理、自动报告、定时任务 |
| 权限管理 | 无 | 组织、工作区、角色、数据权限 |
| 合规审计 | 免责声明 | 审计日志、引用强制、敏感拦截 |

---

## 3. 快速开始

```bash
cp .env.example .env
docker compose up -d postgres redis minio
ollama pull qwen2.5:7b
mvn spring-boot:run
```

**环境要求**：JDK 21+ · Maven 3.9+ · Docker · Ollama

---

## 4. 常见问题（FAQ）

<details>
<summary><b>Q1: 是什么？</b></summary>

**A:** 面向金融机构的AI Agent+RAG系统。券商研究所(批量财报+研报)、私募/基金(组合风险+持仓监控)、上市公司IR(公告+异动)、财经SaaS(API分销)。

</details>

<details>
<summary><b>Q2: 和ChatGPT区别？</b></summary>

**A:** ①可审计——AI输出可追溯 ②可接专业数据——Wind/同花顺/iFinD ③多租户隔离。

</details>

<details>
<summary><b>Q3: 免费吗？</b></summary>

**A:** 社区版Apache-2.0开源免费。企业版多租户/批量财报/异动监控/合规审计/专业数据源。

</details>

<details>
<summary><b>Q4: 支持哪些模型？</b></summary>

**A:** 社区版Ollama(qwen2.5/llama3)。企业版支持OpenAI/DeepSeek/通义千问/私有化。

</details>

<details>
<summary><b>Q5: 硬件要求？</b></summary>

**A:** 最低4核CPU/16GB内存/50GB磁盘。Ollama推理需GPU≥8GB。企业版支持K8s。

</details>


---

## 5. 贡献与许可

- **许可证**：社区版 [Apache-2.0](LICENSE)
- **作者**：[HH-SpringAI-Agent-Starter](https://github.com/HH-SpringAI-Agent-Starter)

---

> 📌 **关联项目**：[FinMind Enterprise（企业版）](https://github.com/HH-SpringAI-Agent-Starter/finmind-enterprise) | [更多项目](https://github.com/HH-SpringAI-Agent-Starter)
