package com.example.finmind.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record MarketAnomalyReport(
        String symbol,
        String latestDate,
        BigDecimal latestClose,
        BigDecimal previousClose,
        BigDecimal priceChangePct,
        Long latestVolume,
        BigDecimal averageVolume,
        BigDecimal volumeSpikeMultiplier,
        boolean priceAnomaly,
        boolean volumeAnomaly,
        List<String> signals,
        String note,
        Instant generatedAt
) {
}
