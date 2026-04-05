package com.portfolioplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for {@link com.portfolioplanner.domain.model.Insight}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InsightDto {

    private Long          id;
    private String        insightType;
    private String        severity;      // HIGH | MEDIUM | LOW
    private String        title;
    private String        description;
    private String        entityType;
    private Long          entityId;
    private String        entityName;
    private LocalDateTime detectedAt;
    private boolean       acknowledged;
    private String        acknowledgedBy;
    private LocalDateTime acknowledgedAt;
}
