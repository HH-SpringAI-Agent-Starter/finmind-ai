package com.example.finmind.web;

import com.example.finmind.agent.FinanceAgentService;
import com.example.finmind.rag.KnowledgeIngestionService;
import com.example.finmind.service.MarketAnomalyReport;
import com.example.finmind.service.MarketAnomalyService;
import com.example.finmind.web.dto.AgentRequest;
import com.example.finmind.web.dto.AgentResponse;
import com.example.finmind.web.dto.IngestResponse;
import com.example.finmind.web.dto.MarketAnomalyRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AgentController {

    private final FinanceAgentService financeAgentService;
    private final KnowledgeIngestionService ingestionService;
    private final MarketAnomalyService anomalyService;

    public AgentController(
            FinanceAgentService financeAgentService,
            KnowledgeIngestionService ingestionService,
            MarketAnomalyService anomalyService
    ) {
        this.financeAgentService = financeAgentService;
        this.ingestionService = ingestionService;
        this.anomalyService = anomalyService;
    }

    @PostMapping(value = "/agent/ask", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public AgentResponse ask(@Valid @RequestBody AgentRequest request) {
        return financeAgentService.ask(
                request.question(),
                request.ticker(),
                request.companyName(),
                request.market(),
                request.horizon(),
                request.riskProfile()
        );
    }

    @PostMapping(value = "/knowledge/ingest", produces = MediaType.APPLICATION_JSON_VALUE)
    public IngestResponse ingest() {
        int chunks = ingestionService.ingestBundledKnowledge();
        return new IngestResponse(chunks, Instant.now());
    }

    @PostMapping(value = "/market/anomaly", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public MarketAnomalyReport anomaly(@Valid @RequestBody MarketAnomalyRequest request) {
        return anomalyService.detect(
                request.symbol(),
                request.lookbackDays() == null ? 20 : request.lookbackDays(),
                request.priceMoveThresholdPct() == null ? BigDecimal.valueOf(3.0) : request.priceMoveThresholdPct(),
                request.volumeSpikeMultiplier() == null ? BigDecimal.valueOf(1.8) : request.volumeSpikeMultiplier()
        );
    }

    @GetMapping("/healthz")
    public Map<String, String> healthz() {
        return Map.of("status", "ok", "service", "finmind-ai");
    }
}
