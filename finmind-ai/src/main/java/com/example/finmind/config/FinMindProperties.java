package com.example.finmind.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "finmind")
public record FinMindProperties(
        Knowledge knowledge,
        AlphaVantage alphaVantage,
        Sec sec
) {
    public record Knowledge(boolean autoIngest, int chunkSize, int chunkOverlap) {
    }

    public record AlphaVantage(String apiKey, String baseUrl) {
    }

    public record Sec(String userAgent) {
    }
}
