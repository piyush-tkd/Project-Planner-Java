package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "app_error_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AppErrorLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String source;             // FRONTEND, BACKEND, API

    @Column(nullable = false)
    private String severity;           // ERROR, WARN, INFO

    @Column(name = "error_type")
    private String errorType;          // e.g. NullPointerException, TypeError, 404, 500

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "stack_trace", columnDefinition = "TEXT")
    private String stackTrace;

    @Column(name = "page_url")
    private String pageUrl;            // Frontend URL where error occurred

    @Column(name = "api_endpoint")
    private String apiEndpoint;        // Backend API path that errored

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(name = "username")
    private String username;

    @Column(name = "component")
    private String component;          // e.g. "CapacityGapPage", "NlpController", etc.

    @Column(name = "resolved")
    private Boolean resolved = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (resolved == null) resolved = false;
        if (severity == null) severity = "ERROR";
    }
}
