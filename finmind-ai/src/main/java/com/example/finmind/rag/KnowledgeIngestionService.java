package com.example.finmind.rag;

import com.example.finmind.config.FinMindProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class KnowledgeIngestionService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeIngestionService.class);

    private final VectorStore vectorStore;
    private final FinMindProperties properties;

    public KnowledgeIngestionService(VectorStore vectorStore, FinMindProperties properties) {
        this.vectorStore = vectorStore;
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void autoIngest() {
        if (properties.knowledge() != null && properties.knowledge().autoIngest()) {
            ingestBundledKnowledge();
        }
    }

    public int ingestBundledKnowledge() {
        try {
            var resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:/knowledge/*.md");

            List<Document> documents = new ArrayList<>();
            for (Resource resource : resources) {
                String text = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
                documents.addAll(split(resource.getFilename(), text));
            }

            if (!documents.isEmpty()) {
                vectorStore.add(documents);
            }

            log.info("Ingested {} financial knowledge chunks into vector store", documents.size());
            return documents.size();
        }
        catch (Exception ex) {
            throw new IllegalStateException("Failed to ingest bundled financial knowledge", ex);
        }
    }

    private List<Document> split(String filename, String text) {
        int chunkSize = properties.knowledge() == null ? 1200 : properties.knowledge().chunkSize();
        int overlap = properties.knowledge() == null ? 160 : properties.knowledge().chunkOverlap();
        int step = Math.max(1, chunkSize - overlap);
        String topic = inferTopic(filename);

        List<Document> result = new ArrayList<>();
        for (int start = 0; start < text.length(); start += step) {
            int end = Math.min(text.length(), start + chunkSize);
            String chunk = text.substring(start, end).trim();
            if (chunk.length() < 80) {
                continue;
            }

            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("source", filename == null ? "bundled" : filename);
            metadata.put("topic", topic);
            metadata.put("chunk_start", start);
            metadata.put("chunk_end", end);
            metadata.put("license", "demo-knowledge");
            result.add(new Document(chunk, metadata));
        }
        return result;
    }

    private String inferTopic(String filename) {
        if (filename == null) {
            return "general";
        }
        return filename.replace(".md", "").replace('-', '_');
    }
}
