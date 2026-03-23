package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "jira_issue_custom_field")
@Getter @Setter @NoArgsConstructor
public class JiraIssueCustomField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    @Column(name = "field_id", nullable = false)
    private String fieldId;

    @Column(name = "field_name")
    private String fieldName;

    @Column(name = "field_value")
    private String fieldValue;

    @Column(name = "field_type")
    private String fieldType;

    public JiraIssueCustomField(String issueKey, String fieldId, String fieldName,
                                 String fieldValue, String fieldType) {
        this.issueKey = issueKey;
        this.fieldId = fieldId;
        this.fieldName = fieldName;
        this.fieldValue = fieldValue;
        this.fieldType = fieldType;
    }
}
