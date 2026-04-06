package com.portfolioplanner.dto;

import com.portfolioplanner.domain.model.ProjectBaseline;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class ProjectBaselineDto {
    private Long id;
    private Long projectId;
    private String label;
    private String snappedBy;
    private LocalDate plannedStart;
    private LocalDate plannedTarget;
    private BigDecimal plannedHours;
    private LocalDateTime snappedAt;

    public static ProjectBaselineDto from(ProjectBaseline b) {
        ProjectBaselineDto d = new ProjectBaselineDto();
        d.id            = b.getId();
        d.projectId     = b.getProjectId();
        d.label         = b.getLabel();
        d.snappedBy     = b.getSnappedBy();
        d.plannedStart  = b.getPlannedStart();
        d.plannedTarget = b.getPlannedTarget();
        d.plannedHours  = b.getPlannedHours();
        d.snappedAt     = b.getSnappedAt();
        return d;
    }

    @Data
    public static class SnapRequest {
        private String label;
    }
}
