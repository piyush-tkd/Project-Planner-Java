package com.portfolioplanner.dto;

import com.portfolioplanner.domain.model.DashboardWidget;
import lombok.Data;

import java.util.Map;

@Data
public class DashboardWidgetDto {
    private Long id;
    private String username;
    private String widgetType;
    private String title;
    private int gridCol;
    private int gridRow;
    private int colSpan;
    private int rowSpan;
    private Map<String, Object> config;

    public static DashboardWidgetDto from(DashboardWidget w) {
        DashboardWidgetDto d = new DashboardWidgetDto();
        d.id         = w.getId();
        d.username   = w.getUsername();
        d.widgetType = w.getWidgetType();
        d.title      = w.getTitle();
        d.gridCol    = w.getGridCol();
        d.gridRow    = w.getGridRow();
        d.colSpan    = w.getColSpan();
        d.rowSpan    = w.getRowSpan();
        d.config     = w.getConfig();
        return d;
    }

    @Data
    public static class SaveRequest {
        private String widgetType;
        private String title;
        private int gridCol;
        private int gridRow;
        private int colSpan = 1;
        private int rowSpan = 1;
        private Map<String, Object> config;
    }

    /** Bulk-save payload — replaces all widgets for the user in one shot */
    @Data
    public static class BulkSaveRequest {
        private java.util.List<SaveRequest> widgets;
    }
}
