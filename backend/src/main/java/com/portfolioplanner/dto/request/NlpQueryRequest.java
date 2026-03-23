package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;

public record NlpQueryRequest(
        @NotBlank String query,
        String currentPage,
        /** Optional conversation context from previous Q&A in the same session. */
        String sessionContext
) {}
