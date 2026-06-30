package com.example.finmind.tools;

import com.example.finmind.client.AlphaVantageClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class MarketDataTools {

    private final AlphaVantageClient alphaVantageClient;

    public MarketDataTools(AlphaVantageClient alphaVantageClient) {
        this.alphaVantageClient = alphaVantageClient;
    }

    @Tool(name = "market_quote_lookup", description = "Fetch a lightweight latest quote snapshot for a stock symbol from Alpha Vantage GLOBAL_QUOTE.")
    public String quote(
            @ToolParam(description = "Stock ticker symbol, for example AAPL, MSFT or IBM") String symbol
    ) {
        Map<String, Object> payload = alphaVantageClient.globalQuote(symbol);
        return alphaVantageClient.toPrettyJson(payload);
    }

    @Tool(name = "market_daily_series", description = "Fetch daily OHLCV time series for market anomaly detection and trend analysis from Alpha Vantage TIME_SERIES_DAILY.")
    public String dailySeries(
            @ToolParam(description = "Stock ticker symbol, for example AAPL, MSFT or IBM") String symbol,
            @ToolParam(description = "compact for latest 100 points, full for full history") String outputSize
    ) {
        Map<String, Object> payload = alphaVantageClient.dailyTimeSeries(symbol, outputSize);
        return alphaVantageClient.toPrettyJson(payload);
    }
}
