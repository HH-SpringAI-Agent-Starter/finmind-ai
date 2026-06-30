package com.example.finmind.web.dto;

import java.time.Instant;

public record AgentResponse(
        String requestId,
        String answer,
        Instant generatedAt
) {
}
