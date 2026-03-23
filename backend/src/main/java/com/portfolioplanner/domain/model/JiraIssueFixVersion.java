package com.portfolioplanner.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "jira_issue_fix_version")
@Getter @Setter @NoArgsConstructor
public class JiraIssueFixVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_key", nullable = false)
    private String issueKey;

    @Column(name = "version_name", nullable = false)
    private String versionName;

    @Column(name = "version_id")
    private String versionId;

    @Column(name = "released")
    private Boolean released = false;

    @Column(name = "release_date")
    private LocalDate releaseDate;

    public JiraIssueFixVersion(String issueKey, String versionName, String versionId,
                                Boolean released, LocalDate releaseDate) {
        this.issueKey = issueKey;
        this.versionName = versionName;
        this.versionId = versionId;
        this.released = released;
        this.releaseDate = releaseDate;
    }
}
