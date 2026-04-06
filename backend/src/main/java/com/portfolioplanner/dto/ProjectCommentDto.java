package com.portfolioplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectCommentDto {

    private Long          id;
    private Long          projectId;
    private Long          parentId;
    private String        author;
    private String        body;
    private boolean       edited;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** Populated only for top-level comments (parentId == null) */
    private List<ProjectCommentDto> replies;

    // ── Nested request DTO ────────────────────────────────────────────────────

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Request {
        private String body;
        private Long   parentId;
    }
}
