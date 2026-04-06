package com.portfolioplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO for AutomationRule — used for both request and response.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AutomationRuleDto {

    private Long   id;
    private String name;
    private String description;
    private boolean enabled;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Trigger
    private String triggerEvent;
    private String triggerValue;

    // Condition (optional)
    private String conditionField;
    private String conditionOperator;
    private String conditionValue;

    // Action
    private String actionType;
    private Map<String, Object> actionPayload;

    // Stats
    private LocalDateTime lastFiredAt;
    private int           fireCount;
}
