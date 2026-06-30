package com.example.finmind.service;

import com.example.finmind.client.AlphaVantageClient;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class MarketAnomalyService {

    private final AlphaVantageClient alphaVantageClient;

    public MarketAnomalyService(AlphaVantageClient alphaVantageClient) {
        this.alphaVantageClient = alphaVantageClient;
    }

    public MarketAnomalyReport detect(String symbol, int lookbackDays, BigDecimal priceMoveThresholdPct, BigDecimal volumeSpikeThreshold) {
        int safeLookback = Math.max(5, Math.min(lookbackDays, 90));
        BigDecimal safePriceThreshold = priceMoveThresholdPct == null ? BigDecimal.valueOf(3) : priceMoveThresholdPct;
        BigDecimal safeVolumeThreshold = volumeSpikeThreshold == null ? BigDecimal.valueOf(1.8) : volumeSpikeThreshold;

        Map<String, Object> payload = alphaVantageClient.dailyTimeSeries(symbol, "compact");
        Map<String, Map<String, String>> series = alphaVantageClient.extractDailySeries(payload);
        if (series.size() < 2) {
            return new MarketAnomalyReport(
                    symbol,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    false,
                    false,
                    List.of("insufficient_data"),
                    "Alpha Vantage did not return enough daily data. Check API key, symbol, rate limit, or market coverage.",
                    Instant.now()
            );
        }

        List<String> dates = series.keySet().stream()
                .sorted(Comparator.reverseOrder())
                .limit(safeLookback)
                .toList();

        String latestDate = dates.get(0);
        String previousDate = dates.get(1);
        BigDecimal latestClose = decimal(series.get(latestDate).get("4. close"));
        BigDecimal previousClose = decimal(series.get(previousDate).get("4. close"));
        Long latestVolume = decimal(series.get(latestDate).get("5. volume")).longValue();

        BigDecimal priceChangePct = latestClose.subtract(previousClose)
                .divide(previousClose, 8, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        BigDecimal averageVolume = dates.stream()
                .skip(1)
                .map(date -> decimal(series.get(date).get("5. volume")))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(Math.max(1, dates.size() - 1)), 4, RoundingMode.HALF_UP);

        BigDecimal volumeSpike = averageVolume.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(latestVolume).divide(averageVolume, 4, RoundingMode.HALF_UP);

        boolean priceAnomaly = priceChangePct.abs().compareTo(safePriceThreshold) >= 0;
        boolean volumeAnomaly = volumeSpike.compareTo(safeVolumeThreshold) >= 0;

        List<String> signals = new ArrayList<>();
        if (priceAnomaly) {
            signals.add("price_move_over_threshold");
        }
        if (volumeAnomaly) {
            signals.add("volume_spike_over_threshold");
        }
        if (signals.isEmpty()) {
            signals.add("no_major_anomaly_by_current_thresholds");
        }

        return new MarketAnomalyReport(
                symbol,
                latestDate,
                round(latestClose),
                round(previousClose),
                round(priceChangePct),
                latestVolume,
                round(averageVolume),
                round(volumeSpike),
                priceAnomaly,
                volumeAnomaly,
                signals,
                "This is a threshold-based monitoring signal, not trading advice. Validate against filings, news, index moves and liquidity.",
                Instant.now()
        );
    }

    private BigDecimal decimal(String value) {
        return new BigDecimal(value == null || value.isBlank() ? "0" : value.trim());
    }

    private BigDecimal round(BigDecimal value) {
        return value == null ? null : value.setScale(4, RoundingMode.HALF_UP);
    }
}
