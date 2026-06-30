package com.example.finmind.web.dto;

import java.time.Instant;

public record IngestResponse(
        int chunks,
        Instant ingestedAt
) {
}
