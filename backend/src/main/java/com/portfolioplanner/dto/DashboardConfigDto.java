package com.portfolioplanner.dto;

import com.portfolioplanner.domain.model.DashboardConfig;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DashboardConfigDto {
    private Long id;
    private String name;
    private String description;
    private boolean isDefault;
    private boolean isTemplate;
    private String templateName;
    private String config;
    private String thumbnailUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static DashboardConfigDto from(DashboardConfig e) {
        DashboardConfigDto d = new DashboardConfigDto();
        d.id = e.getId();
        d.name = e.getName();
        d.description = e.getDescription();
        d.isDefault = e.isDefault();
        d.isTemplate = e.isTemplate();
        d.templateName = e.getTemplateName();
        d.config = e.getConfig();
        d.thumbnailUrl = e.getThumbnailUrl();
        d.createdAt = e.getCreatedAt();
        d.updatedAt = e.getUpdatedAt();
        return d;
    }
}
