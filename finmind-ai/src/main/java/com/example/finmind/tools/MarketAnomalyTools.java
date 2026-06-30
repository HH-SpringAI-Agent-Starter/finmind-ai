package com.example.finmind.tools;

import com.example.finmind.service.MarketAnomalyReport;
import com.example.finmind.service.MarketAnomalyService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class MarketAnomalyTools {

    private final MarketAnomalyService marketAnomalyService;

    public MarketAnomalyTools(MarketAnomalyService marketAnomalyService) {
        this.marketAnomalyService = marketAnomalyService;
    }

    @Tool(name = "detect_market_anomaly", description = "Detect stock market anomalies using daily price change and volume spike thresholds.")
    public MarketAnomalyReport detect(
            @ToolParam(description = "Stock ticker symbol, for example AAPL, MSFT or IBM") String symbol,
            @ToolParam(description = "Lookback days for average volume, usually 20") Integer lookbackDays,
            @ToolParam(description = "Absolute daily price move threshold in percent, for example 3.0") BigDecimal priceMoveThresholdPct,
            @ToolParam(description = "Volume spike threshold versus average volume, for example 1.8") BigDecimal volumeSpikeMultiplier
    ) {
        return marketAnomalyService.detect(
                symbol,
                lookbackDays == null ? 20 : lookbackDays,
                priceMoveThresholdPct,
                volumeSpikeMultiplier
        );
    }
}
