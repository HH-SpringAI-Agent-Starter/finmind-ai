package com.example.finmind.web.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record MarketAnomalyRequest(
        @NotBlank(message = "symbol is required")
        String symbol,
        Integer lookbackDays,
        BigDecimal priceMoveThresholdPct,
        BigDecimal volumeSpikeMultiplier
) {
}
