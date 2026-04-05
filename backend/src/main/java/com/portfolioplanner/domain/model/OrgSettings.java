package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "org_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrgSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false, unique = true)
    private Long orgId;

    @Column(name = "org_name", length = 255)
    private String orgName;

    @Column(name = "org_slug", length = 100)
    private String orgSlug;

    @Column(name = "logo_url", columnDefinition = "TEXT")
    private String logoUrl;

    @Column(name = "primary_color", length = 20)
    private String primaryColor;

    @Column(name = "secondary_color", length = 20)
    private String secondaryColor;

    @Column(name = "timezone", length = 100)
    private String timezone;

    @Column(name = "date_format", length = 50)
    private String dateFormat;

    @Column(name = "fiscal_year_start", length = 20)
    private String fiscalYearStart;

    /** Feature flags — keys: ai, okr, risk, ideas, financials */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "features", columnDefinition = "jsonb")
    private Map<String, Boolean> features;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
