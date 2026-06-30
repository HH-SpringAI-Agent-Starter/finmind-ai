package com.example.finmind.web.dto;

import jakarta.validation.constraints.NotBlank;

public record AgentRequest(
        @NotBlank(message = "question is required")
        String question,
        String ticker,
        String companyName,
        String market,
        String horizon,
        String riskProfile
) {
}
