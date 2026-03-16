package com.portfolioplanner.dto.response;

public record TshirtSizeResponse(
        Long id,
        String name,
        int baseHours,
        int displayOrder
) {
}
