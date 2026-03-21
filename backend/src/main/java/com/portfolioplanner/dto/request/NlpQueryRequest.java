package com.portfolioplanner.dto.request;

import jakarta.validation.constraints.NotBlank;

public record NlpQueryRequest(
        @NotBlank String query,
        String currentPage
) {}
