package com.portfolioplanner.dto.response;

import java.time.Instant;
import java.util.List;

public record NlpConversationResponse(
    Long id,
    String title,
    boolean isPinned,
    int messageCount,
    Instant lastMessageAt,
    Instant createdAt,
    List<MessageResponse> messages  // null for list view, populated for detail view
) {
    public record MessageResponse(
        Long id,
        String role,
        String content,
        String intent,
        Double confidence,
        String resolvedBy,
        NlpQueryResponse.NlpResponsePayload responsePayload, // parsed from responseData JSON
        List<String> suggestions,
        Integer responseMs,
        Instant createdAt
    ) {}
}
