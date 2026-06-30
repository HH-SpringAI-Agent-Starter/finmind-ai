package com.example.finmind.tools;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Component
public class FinancialCalculatorTools {

    @Tool(name = "calculate_financial_ratio", description = "Calculate common financial ratios such as growth rate, gross margin, operating margin, net margin, debt ratio, current ratio and free cash flow.")
    public Map<String, Object> calculate(
            @ToolParam(description = "Ratio type: growth_rate, gross_margin, operating_margin, net_margin, debt_ratio, current_ratio, free_cash_flow") String ratioType,
            @ToolParam(description = "Numerator or current period value") BigDecimal numerator,
            @ToolParam(description = "Denominator or previous period value") BigDecimal denominator,
            @ToolParam(description = "Optional second input, for example capex for free cash flow") BigDecimal extra
    ) {
        String type = ratioType == null ? "" : ratioType.trim().toLowerCase(Locale.ROOT);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ratioType", type);

        switch (type) {
            case "growth_rate" -> {
                BigDecimal value = safeDivide(numerator.subtract(denominator), denominator).multiply(BigDecimal.valueOf(100));
                result.put("formula", "(current - previous) / previous * 100%");
                result.put("value", round(value));
                result.put("unit", "%");
            }
            case "gross_margin", "operating_margin", "net_margin" -> {
                BigDecimal value = safeDivide(numerator, denominator).multiply(BigDecimal.valueOf(100));
                result.put("formula", "profit / revenue * 100%");
                result.put("value", round(value));
                result.put("unit", "%");
            }
            case "debt_ratio" -> {
                BigDecimal value = safeDivide(numerator, denominator).multiply(BigDecimal.valueOf(100));
                result.put("formula", "liabilities / assets * 100%");
                result.put("value", round(value));
                result.put("unit", "%");
            }
            case "current_ratio" -> {
                BigDecimal value = safeDivide(numerator, denominator);
                result.put("formula", "current assets / current liabilities");
                result.put("value", round(value));
                result.put("unit", "x");
            }
            case "free_cash_flow" -> {
                BigDecimal capex = extra == null ? BigDecimal.ZERO : extra;
                BigDecimal value = numerator.subtract(capex.abs());
                result.put("formula", "operating cash flow - capital expenditures");
                result.put("value", round(value));
                result.put("unit", "same as input currency");
            }
            default -> {
                result.put("error", "Unsupported ratio type");
                result.put("supported", "growth_rate, gross_margin, operating_margin, net_margin, debt_ratio, current_ratio, free_cash_flow");
            }
        }
        result.put("note", "Calculation is mechanical only. Verify accounting definitions, period alignment and units before using it in analysis.");
        return result;
    }

    public BigDecimal safeDivide(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
            throw new IllegalArgumentException("Numerator and non-zero denominator are required");
        }
        return numerator.divide(denominator, 8, RoundingMode.HALF_UP);
    }

    private BigDecimal round(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP);
    }
}
