package com.example.finmind.rag;

import org.springframework.ai.document.Document;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class FinancialKnowledgeTools {

    private final VectorStore vectorStore;

    public FinancialKnowledgeTools(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    @Tool(name = "financial_knowledge_search", description = "Search the financial RAG knowledge base for financial statement analysis, valuation, anomaly monitoring, risk and compliance guidance.")
    public String search(
            @ToolParam(description = "The finance research question or search query") String query,
            @ToolParam(description = "Number of relevant knowledge chunks to retrieve, usually 3 to 6") Integer topK
    ) {
        int safeTopK = topK == null ? 5 : Math.max(1, Math.min(topK, 8));
        List<Document> documents = vectorStore.similaritySearch(SearchRequest.builder()
                .query(query)
                .topK(safeTopK)
                .similarityThreshold(0.35)
                .build());

        if (documents == null || documents.isEmpty()) {
            return "知识库没有检索到足够相关的内容。请让用户补充公司、行业、财报口径、时间范围或上传研究材料。";
        }

        return documents.stream()
                .map(this::formatDocument)
                .collect(Collectors.joining("\n\n---\n\n"));
    }

    private String formatDocument(Document document) {
        Map<String, Object> metadata = document.getMetadata();
        return "来源：%s\n主题：%s\n内容：%s".formatted(
                metadata.getOrDefault("source", "unknown"),
                metadata.getOrDefault("topic", "general"),
                document.getText()
        );
    }
}
