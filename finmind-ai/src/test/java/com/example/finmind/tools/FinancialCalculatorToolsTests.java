package com.example.finmind.tools;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class FinancialCalculatorToolsTests {

    private final FinancialCalculatorTools tools = new FinancialCalculatorTools();

    @Test
    void calculatesGrowthRate() {
        var result = tools.calculate("growth_rate", BigDecimal.valueOf(120), BigDecimal.valueOf(100), null);
        assertThat(result.get("value").toString()).isEqualTo("20.0000");
        assertThat(result.get("unit")).isEqualTo("%");
    }

    @Test
    void calculatesCurrentRatio() {
        var result = tools.calculate("current_ratio", BigDecimal.valueOf(200), BigDecimal.valueOf(80), null);
        assertThat(result.get("value").toString()).isEqualTo("2.5000");
        assertThat(result.get("unit")).isEqualTo("x");
    }
}
