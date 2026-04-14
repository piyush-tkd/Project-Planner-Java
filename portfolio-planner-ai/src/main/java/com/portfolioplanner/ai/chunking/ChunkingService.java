package com.portfolioplanner.ai.chunking;

import com.portfolioplanner.ai.data.ProjectDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Converts portfolio entities into text chunks and upserts them into pgvector.
 *
 * Each project produces up to 4 chunks:
 *   CORE        — name, status, health, owner, dates, budget
 *   RISKS       — all risks aggregated (skipped if none)
 *   MILESTONES  — all milestones aggregated (skipped if none)
 *   TEAM        — allocation summary (skipped if none)
 *
 * Metadata stored per chunk:
 *   entity_type  → "PROJECT"
 *   entity_id    → project id (string, pgvector metadata must be string)
 *   chunk_type   → CORE | RISKS | MILESTONES | TEAM
 *   project_name → for display in UI "sources" panel
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChunkingService {

    private final ProjectDataRepository repo;
    private final VectorStore vectorStore;
    private final JdbcTemplate jdbc;

    // ── Public API ────────────────────────────────────────────────────────────

    public int indexProject(Long projectId) {
        Map<String, Object> project = repo.findProjectById(projectId);
        if (project == null) {
            log.warn("ChunkingService: project {} not found, skipping", projectId);
            return 0;
        }

        // Delete all existing chunks for this project before re-inserting
        deleteProjectChunks(projectId);

        List<Document> docs = buildProjectDocuments(project);
        if (!docs.isEmpty()) {
            vectorStore.add(docs);
        }

        recordSyncLog("PROJECT", projectId, docs.size(), null);
        log.debug("Indexed project {} ({}) → {} chunks",
                projectId, project.get("name"), docs.size());
        return docs.size();
    }

    public int indexAllProjects() {
        List<Long> ids = repo.findAllProjectIds();
        int total = 0;
        for (Long id : ids) {
            try {
                total += indexProject(id);
            } catch (Exception e) {
                log.error("Failed to index project {}: {}", id, e.getMessage());
                recordSyncLog("PROJECT", id, 0, e.getMessage());
            }
        }
        recordSyncLog("FULL_REINDEX", null, total, null);
        log.info("Full re-index complete: {} projects, {} chunks", ids.size(), total);
        return total;
    }

    // ── Document builders ─────────────────────────────────────────────────────

    private List<Document> buildProjectDocuments(Map<String, Object> p) {
        List<Document> docs = new ArrayList<>();
        Long id = toLong(p.get("id"));
        String name = str(p.get("name"));

        // ── Chunk 1: CORE (always written — never skip)
        docs.add(new Document(buildCoreChunk(p),
                Map.of(
                        "entity_type",  "PROJECT",
                        "entity_id",    String.valueOf(id),
                        "chunk_type",   "CORE",
                        "project_name", name
                )));

        // ── Chunk 2: RISKS
        safeChunk(name, id, "RISKS", docs, () -> {
            List<Map<String, Object>> risks = repo.findRisksByProject(id);
            if (!risks.isEmpty()) return buildRisksChunk(name, risks);
            return null;
        });

        // ── Chunk 3: JIRA ISSUES (only for Jira-synced projects)
        safeChunk(name, id, "ISSUES", docs, () -> {
            List<Map<String, Object>> issues = repo.findIssuesByProject(id);
            if (!issues.isEmpty()) return buildIssuesChunk(name, issues);
            return null;
        });

        // ── Chunk 4: TEAM
        safeChunk(name, id, "TEAM", docs, () -> {
            List<Map<String, Object>> team = repo.findResourcesForProject(id);
            if (!team.isEmpty()) return buildTeamChunk(name, team);
            return null;
        });

        return docs;
    }

    /** Wraps each optional chunk query — logs warning on failure but never breaks the index run. */
    private void safeChunk(String projectName, Long projectId, String chunkType,
                           List<Document> docs, java.util.function.Supplier<String> textFn) {
        try {
            String text = textFn.get();
            if (text != null) {
                docs.add(new Document(text, Map.of(
                        "entity_type",  "PROJECT",
                        "entity_id",    String.valueOf(projectId),
                        "chunk_type",   chunkType,
                        "project_name", projectName
                )));
            }
        } catch (Exception e) {
            log.warn("Skipping {} chunk for project {} ({}): {}", chunkType, projectId, projectName, e.getMessage());
        }
    }

    // ── Text builders ─────────────────────────────────────────────────────────

    private String buildCoreChunk(Map<String, Object> p) {
        return """
                Project: %s
                Status: %s
                Owner: %s
                Start Date: %s | End Date: %s
                Budget: %s | Actual Cost: %s
                Source: %s
                Description: %s
                """.formatted(
                str(p.get("name")),
                str(p.get("status")),
                str(p.get("owner")),
                str(p.get("start_date")),
                str(p.get("end_date")),
                str(p.get("estimated_budget")),
                str(p.get("actual_cost")),
                str(p.get("source_type")),
                str(p.get("description"))
        );
    }

    private String buildRisksChunk(String projectName, List<Map<String, Object>> risks) {
        StringBuilder sb = new StringBuilder();
        sb.append("Project: ").append(projectName).append(" — Risks\n\n");
        for (Map<String, Object> r : risks) {
            sb.append("Risk: ").append(str(r.get("title"))).append("\n");
            sb.append("  Severity: ").append(str(r.get("severity")));
            sb.append(" | Likelihood: ").append(str(r.get("likelihood")));
            sb.append(" | Status: ").append(str(r.get("status"))).append("\n");
            if (r.get("mitigation_plan") != null) {
                sb.append("  Mitigation: ").append(str(r.get("mitigation_plan"))).append("\n");
            }
            if (r.get("owner") != null) {
                sb.append("  Owner: ").append(str(r.get("owner"))).append("\n");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String buildIssuesChunk(String projectName, List<Map<String, Object>> issues) {
        StringBuilder sb = new StringBuilder();
        sb.append("Project: ").append(projectName).append(" — Jira Issues\n\n");
        for (Map<String, Object> i : issues) {
            sb.append(str(i.get("issue_key"))).append(": ").append(str(i.get("summary"))).append("\n");
            sb.append("  Type: ").append(str(i.get("issue_type")));
            sb.append(" | Status: ").append(str(i.get("status_name")));
            sb.append(" | Priority: ").append(str(i.get("priority_name")));
            if (i.get("assignee_display_name") != null) {
                sb.append(" | Assignee: ").append(str(i.get("assignee_display_name")));
            }
            if (i.get("story_points") != null) {
                sb.append(" | Points: ").append(str(i.get("story_points")));
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String buildTeamChunk(String projectName, List<Map<String, Object>> team) {
        StringBuilder sb = new StringBuilder();
        sb.append("Project: ").append(projectName).append(" — Team Members\n\n");
        for (Map<String, Object> t : team) {
            sb.append(str(t.get("name")));
            sb.append(" (").append(str(t.get("role"))).append(")\n");
        }
        return sb.toString();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Removes all existing vector chunks for a project so re-indexing
     * doesn't produce duplicates. Uses JDBC because VectorStore.delete()
     * requires knowing UUIDs upfront.
     */
    private void deleteProjectChunks(Long projectId) {
        int deleted = jdbc.update(
                "DELETE FROM ai.vector_store WHERE metadata->>'entity_id' = ? " +
                "AND metadata->>'entity_type' = 'PROJECT'",
                String.valueOf(projectId));
        if (deleted > 0) {
            log.debug("Deleted {} stale chunks for project {}", deleted, projectId);
        }
    }

    private void recordSyncLog(String entityType, Long entityId, int chunks, String error) {
        jdbc.update(
                "INSERT INTO ai.sync_log (entity_type, entity_id, chunks_created, status, error_message) " +
                "VALUES (?, ?, ?, ?, ?)",
                entityType, entityId, chunks,
                error == null ? "SUCCESS" : "ERROR",
                error);
    }

    private String str(Object o) {
        return o == null ? "N/A" : o.toString();
    }

    private Long toLong(Object o) {
        if (o == null) return 0L;
        if (o instanceof Long l) return l;
        if (o instanceof Integer i) return i.longValue();
        return Long.parseLong(o.toString());
    }
}
