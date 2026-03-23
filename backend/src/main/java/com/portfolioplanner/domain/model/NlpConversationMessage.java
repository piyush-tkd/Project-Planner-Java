package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "nlp_conversation_message")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NlpConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(nullable = false, length = 20)
    private String role;  // 'user' or 'assistant'

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;  // the message text

    @Column(length = 50)
    private String intent;  // detected intent (for assistant messages)

    @Column(name = "confidence")
    private Double confidence;  // confidence score

    @Column(name = "resolved_by", length = 50)
    private String resolvedBy;  // which strategy resolved it

    @Column(name = "response_data", columnDefinition = "TEXT")
    private String responseData;  // JSON blob of structured response data (route, formData, data, drillDown)

    @Column(name = "suggestions", columnDefinition = "TEXT")
    private String suggestions;  // JSON array of follow-up suggestions

    @Column(name = "tool_calls", columnDefinition = "TEXT")
    private String toolCalls;  // JSON array of tool calls made

    @Column(name = "response_ms")
    private Integer responseMs;  // response time in ms

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}
