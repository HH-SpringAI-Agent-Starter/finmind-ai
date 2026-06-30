package com.example.finmind.client;

import com.example.finmind.config.FinMindProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AlphaVantageClient {

    private final RestClient restClient;
    private final FinMindProperties properties;
    private final ObjectMapper objectMapper;

    public AlphaVantageClient(RestClient.Builder builder, FinMindProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        String baseUrl = properties.alphaVantage() == null || !StringUtils.hasText(properties.alphaVantage().baseUrl())
                ? "https://www.alphavantage.co"
                : properties.alphaVantage().baseUrl();
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    public Map<String, Object> globalQuote(String symbol) {
        if (!StringUtils.hasText(apiKey())) {
            return Map.of("error", "ALPHA_VANTAGE_API_KEY is not configured");
        }
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/query")
                        .queryParam("function", "GLOBAL_QUOTE")
                        .queryParam("symbol", symbol)
                        .queryParam("apikey", apiKey())
                        .build())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }

    public Map<String, Object> dailyTimeSeries(String symbol, String outputSize) {
        if (!StringUtils.hasText(apiKey())) {
            return Map.of("error", "ALPHA_VANTAGE_API_KEY is not configured");
        }
        String safeOutputSize = "full".equalsIgnoreCase(outputSize) ? "full" : "compact";
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/query")
                        .queryParam("function", "TIME_SERIES_DAILY")
                        .queryParam("symbol", symbol)
                        .queryParam("outputsize", safeOutputSize)
                        .queryParam("apikey", apiKey())
                        .build())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }

    public String toPrettyJson(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        }
        catch (JsonProcessingException ex) {
            return String.valueOf(value);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Map<String, String>> extractDailySeries(Map<String, Object> payload) {
        Object series = payload == null ? null : payload.get("Time Series (Daily)");
        if (series instanceof Map<?, ?> raw) {
            Map<String, Map<String, String>> result = new LinkedHashMap<>();
            raw.forEach((date, values) -> {
                Map<String, String> converted = objectMapper.convertValue(values, new TypeReference<>() {
                });
                result.put(String.valueOf(date), converted);
            });
            return result;
        }
        return Map.of();
    }

    private String apiKey() {
        return properties.alphaVantage() == null ? null : properties.alphaVantage().apiKey();
    }
}
