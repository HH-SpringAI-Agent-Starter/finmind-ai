package com.example.finmind.tools;

import com.example.finmind.client.SecEdgarClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Component
public class SecFilingTools {

    private static final List<String> KEY_US_GAAP_TAGS = List.of(
            "Revenues",
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "NetIncomeLoss",
            "OperatingIncomeLoss",
            "GrossProfit",
            "Assets",
            "Liabilities",
            "StockholdersEquity",
            "CashAndCashEquivalentsAtCarryingValue",
            "NetCashProvidedByUsedInOperatingActivities",
            "EarningsPerShareDiluted"
    );

    private final SecEdgarClient secEdgarClient;

    public SecFilingTools(SecEdgarClient secEdgarClient) {
        this.secEdgarClient = secEdgarClient;
    }

    @Tool(name = "sec_company_lookup", description = "Find SEC company metadata and CIK by stock ticker. Use this before fetching SEC filings or XBRL facts.")
    public String companyLookup(
            @ToolParam(description = "Stock ticker symbol, for example AAPL or MSFT") String ticker
    ) {
        Optional<Map<String, Object>> company = secEdgarClient.findCompanyByTicker(ticker);
        return company.map(secEdgarClient::toPrettyJson)
                .orElse("没有找到 ticker 对应的 SEC 公司信息。仅支持 SEC company_tickers.json 中覆盖的公司。Ticker=" + ticker);
    }

    @Tool(name = "sec_latest_filings", description = "Fetch recent SEC filings such as 10-K, 10-Q and 8-K for a US public company by ticker or CIK.")
    public String latestFilings(
            @ToolParam(description = "Ticker symbol like AAPL, or numeric CIK") String tickerOrCik,
            @ToolParam(description = "Maximum number of recent filings to return, usually 5 to 20") Integer limit
    ) {
        String cik = resolveCik(tickerOrCik);
        if (cik == null) {
            return "无法解析 CIK。请提供有效 ticker 或 CIK。输入=" + tickerOrCik;
        }

        Map<String, Object> payload = secEdgarClient.latestSubmissions(cik);
        Map<String, Object> compact = compactRecentFilings(payload, limit == null ? 10 : limit);
        return secEdgarClient.toPrettyJson(compact);
    }

    @Tool(name = "sec_company_facts_compact", description = "Fetch compact key SEC XBRL financial facts for a US public company by ticker or CIK. Useful for financial statement analysis.")
    public String companyFactsCompact(
            @ToolParam(description = "Ticker symbol like AAPL, or numeric CIK") String tickerOrCik
    ) {
        String cik = resolveCik(tickerOrCik);
        if (cik == null) {
            return "无法解析 CIK。请提供有效 ticker 或 CIK。输入=" + tickerOrCik;
        }

        Map<String, Object> facts = secEdgarClient.companyFacts(cik);
        Map<String, Object> compact = compactFacts(facts, cik);
        return secEdgarClient.toPrettyJson(compact);
    }

    private String resolveCik(String tickerOrCik) {
        if (tickerOrCik == null || tickerOrCik.isBlank()) {
            return null;
        }
        if (tickerOrCik.replaceAll("\\D", "").length() >= 4 && tickerOrCik.matches(".*\\d.*")) {
            return secEdgarClient.cik10(tickerOrCik);
        }
        return secEdgarClient.findCompanyByTicker(tickerOrCik)
                .map(item -> String.valueOf(item.get("cik10")))
                .orElse(null);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> compactRecentFilings(Map<String, Object> payload, int limit) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cik", payload == null ? null : payload.get("cik"));
        result.put("name", payload == null ? null : payload.get("name"));
        result.put("source", "SEC EDGAR submissions API");

        Object filingsObj = payload == null ? null : payload.get("filings");
        if (!(filingsObj instanceof Map<?, ?> filings)) {
            result.put("recent", List.of());
            return result;
        }
        Object recentObj = filings.get("recent");
        if (!(recentObj instanceof Map<?, ?> recent)) {
            result.put("recent", List.of());
            return result;
        }

        List<String> forms = list(recent.get("form"));
        List<String> filingDates = list(recent.get("filingDate"));
        List<String> reportDates = list(recent.get("reportDate"));
        List<String> accessionNumbers = list(recent.get("accessionNumber"));
        List<String> primaryDocuments = list(recent.get("primaryDocument"));

        int size = Math.min(Math.min(forms.size(), filingDates.size()), Math.max(1, Math.min(limit, 20)));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("form", forms.get(i));
            row.put("filingDate", valueAt(filingDates, i));
            row.put("reportDate", valueAt(reportDates, i));
            row.put("accessionNumber", valueAt(accessionNumbers, i));
            row.put("primaryDocument", valueAt(primaryDocuments, i));
            rows.add(row);
        }
        result.put("recent", rows);
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> compactFacts(Map<String, Object> facts, String cik) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cik", cik);
        result.put("entityName", facts == null ? null : facts.get("entityName"));
        result.put("source", "SEC EDGAR companyfacts API");
        result.put("note", "Values are extracted from selected US-GAAP tags. Always verify fiscal period, form, unit and filed date.");

        Object factsObj = facts == null ? null : facts.get("facts");
        if (!(factsObj instanceof Map<?, ?> factsMap)) {
            result.put("metrics", Map.of());
            return result;
        }
        Object usGaapObj = factsMap.get("us-gaap");
        if (!(usGaapObj instanceof Map<?, ?> usGaap)) {
            result.put("metrics", Map.of());
            return result;
        }

        Map<String, Object> metrics = new LinkedHashMap<>();
        for (String tag : KEY_US_GAAP_TAGS) {
            Object tagObj = usGaap.get(tag);
            if (!(tagObj instanceof Map<?, ?> tagMap)) {
                continue;
            }
            Object unitsObj = tagMap.get("units");
            if (!(unitsObj instanceof Map<?, ?> units)) {
                continue;
            }
            Map<String, Object> tagResult = new LinkedHashMap<>();
            tagResult.put("label", tagMap.get("label"));
            tagResult.put("description", tagMap.get("description"));
            for (Map.Entry<?, ?> unitEntry : units.entrySet()) {
                List<Map<String, Object>> latest = latestFacts(unitEntry.getValue(), 5);
                if (!latest.isEmpty()) {
                    tagResult.put(String.valueOf(unitEntry.getKey()), latest);
                }
            }
            if (tagResult.size() > 2) {
                metrics.put(tag, tagResult);
            }
        }
        result.put("metrics", metrics);
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> latestFacts(Object value, int limit) {
        if (!(value instanceof List<?> rows)) {
            return List.of();
        }
        return rows.stream()
                .filter(Map.class::isInstance)
                .map(row -> (Map<String, Object>) row)
                .sorted(Comparator
                        .comparing((Map<String, Object> row) -> String.valueOf(row.getOrDefault("filed", "")))
                        .thenComparing(row -> String.valueOf(row.getOrDefault("end", "")))
                        .reversed())
                .limit(limit)
                .map(row -> {
                    Map<String, Object> compact = new LinkedHashMap<>();
                    compact.put("val", row.get("val"));
                    compact.put("fy", row.get("fy"));
                    compact.put("fp", row.get("fp"));
                    compact.put("form", row.get("form"));
                    compact.put("filed", row.get("filed"));
                    compact.put("start", row.get("start"));
                    compact.put("end", row.get("end"));
                    compact.put("frame", row.get("frame"));
                    return compact;
                })
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<String> list(Object value) {
        if (value instanceof List<?> rows) {
            return rows.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    private String valueAt(List<String> values, int index) {
        return index < values.size() ? values.get(index) : null;
    }
}
