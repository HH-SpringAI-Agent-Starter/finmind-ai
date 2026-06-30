package com.example.finmind.client;

import com.example.finmind.config.FinMindProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class SecEdgarClient {

    private final RestClient restClient;
    private final FinMindProperties properties;
    private final ObjectMapper objectMapper;

    public SecEdgarClient(RestClient.Builder builder, FinMindProperties properties, ObjectMapper objectMapper) {
        this.restClient = builder.build();
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public Optional<Map<String, Object>> findCompanyByTicker(String ticker) {
        String normalized = ticker == null ? "" : ticker.trim().toUpperCase(Locale.ROOT);
        if (!StringUtils.hasText(normalized)) {
            return Optional.empty();
        }

        Map<String, Map<String, Object>> companies = restClient.get()
                .uri("https://www.sec.gov/files/company_tickers.json")
                .header("User-Agent", userAgent())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });

        if (companies == null) {
            return Optional.empty();
        }

        return companies.values().stream()
                .filter(item -> normalized.equalsIgnoreCase(String.valueOf(item.get("ticker"))))
                .findFirst()
                .map(this::normalizeCompany);
    }

    public Map<String, Object> latestSubmissions(String cik) {
        String normalizedCik = cik10(cik);
        return restClient.get()
                .uri("https://data.sec.gov/submissions/CIK%s.json".formatted(normalizedCik))
                .header("User-Agent", userAgent())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }

    public Map<String, Object> companyFacts(String cik) {
        String normalizedCik = cik10(cik);
        return restClient.get()
                .uri("https://data.sec.gov/api/xbrl/companyfacts/CIK%s.json".formatted(normalizedCik))
                .header("User-Agent", userAgent())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
    }

    public String cik10(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        return "0".repeat(Math.max(0, 10 - digits.length())) + digits;
    }

    public String toPrettyJson(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        }
        catch (JsonProcessingException ex) {
            return String.valueOf(value);
        }
    }

    public String userAgent() {
        if (properties.sec() != null && StringUtils.hasText(properties.sec().userAgent())) {
            return properties.sec().userAgent();
        }
        return "FinMindAI/0.1 contact@example.com";
    }

    private Map<String, Object> normalizeCompany(Map<String, Object> raw) {
        Map<String, Object> result = new LinkedHashMap<>();
        Object cik = raw.get("cik_str");
        result.put("ticker", raw.get("ticker"));
        result.put("title", raw.get("title"));
        result.put("cik", cik);
        result.put("cik10", cik10(String.valueOf(cik)));
        return result;
    }
}
