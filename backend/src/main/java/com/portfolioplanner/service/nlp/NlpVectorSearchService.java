package com.portfolioplanner.service.nlp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolioplanner.domain.model.NlpEmbedding;
import com.portfolioplanner.domain.repository.NlpEmbeddingRepository;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Manages entity embeddings and provides semantic search capabilities.
 * <p>
 * Two main responsibilities:
 * 1. INDEXING: Embed catalog entities + successful query patterns into pgvector
 * 2. SEARCHING: Find semantically similar entities/patterns for a user query
 */
@Service
public class NlpVectorSearchService {

    private static final Logger log = LoggerFactory.getLogger(NlpVectorSearchService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final EmbeddingService embeddingService;
    private final NlpEmbeddingRepository embeddingRepo;
    private final DataSource dataSource;

    /** Cached result of pgvector availability check — null means not yet checked. */
    private volatile Boolean pgvectorAvailable = null;

    public NlpVectorSearchService(EmbeddingService embeddingService,
                                   NlpEmbeddingRepository embeddingRepo,
                                   DataSource dataSource) {
        this.embeddingService = embeddingService;
        this.embeddingRepo = embeddingRepo;
        this.dataSource = dataSource;
    }

    /**
     * Check whether the pgvector extension is installed AND the embedding column exists.
     * Result is cached after first successful check.
     */
    public boolean isPgvectorAvailable() {
        if (pgvectorAvailable != null) return pgvectorAvailable;
        try (Connection conn = dataSource.getConnection()) {
            // Check if the 'embedding' column exists on nlp_embedding
            ResultSet rs = conn.getMetaData().getColumns(null, null, "nlp_embedding", "embedding");
            pgvectorAvailable = rs.next();
            if (!pgvectorAvailable) {
                log.info("pgvector not available — embedding column missing from nlp_embedding. " +
                         "Install pgvector (brew install pgvector), restart PostgreSQL, and re-run the migration.");
            }
            return pgvectorAvailable;
        } catch (Exception e) {
            log.debug("pgvector availability check failed: {}", e.getMessage());
            return false;
        }
    }

    /** Reset the cached pgvector availability (e.g. after admin installs pgvector). */
    public void resetPgvectorCheck() {
        pgvectorAvailable = null;
    }

    /**
     * True only if BOTH the embedding model (Ollama) AND pgvector are available.
     */
    private boolean isVectorSearchReady() {
        return embeddingService.isAvailable() && isPgvectorAvailable();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SEARCH — Find relevant context for a user query
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Search result record returned by semantic search.
     */
    public record VectorSearchResult(
            Long id,
            String entityType,
            Long entityId,
            String entityName,
            String contentText,
            String intent,
            String route,
            String metadata,
            String source,
            double confidence,
            double distance  // cosine distance: 0 = identical, 2 = opposite
    ) {
        /** Cosine similarity = 1 - distance. Range: -1 to 1. */
        public double similarity() {
            return 1.0 - distance;
        }
    }

    /**
     * Find the top-K most semantically similar entities to the query.
     * Returns empty list if embeddings are not available.
     */
    public List<VectorSearchResult> search(String query, int topK) {
        if (!isVectorSearchReady()) return List.of();

        float[] queryVector = embeddingService.embed(query);
        if (queryVector == null) return List.of();

        String pgVector = EmbeddingService.toPgVector(queryVector);
        List<Object[]> rows = embeddingRepo.findNearestNeighbors(pgVector, topK);
        return mapResults(rows);
    }

    /**
     * Find the top-K most similar entities filtered by type(s).
     */
    public List<VectorSearchResult> searchByTypes(String query, List<String> entityTypes, int topK) {
        if (!isVectorSearchReady()) return List.of();

        float[] queryVector = embeddingService.embed(query);
        if (queryVector == null) return List.of();

        String pgVector = EmbeddingService.toPgVector(queryVector);
        // Convert list to PostgreSQL array format
        String typesArray = "{" + String.join(",", entityTypes) + "}";
        List<Object[]> rows = embeddingRepo.findNearestByTypes(pgVector, typesArray, topK);
        return mapResults(rows);
    }

    /**
     * Find the most similar learned query patterns (for intent resolution).
     * Returns patterns with high similarity that can be used to resolve intent
     * without calling the LLM at all.
     */
    public List<VectorSearchResult> searchQueryPatterns(String query, int topK) {
        if (!isVectorSearchReady()) return List.of();

        float[] queryVector = embeddingService.embed(query);
        if (queryVector == null) return List.of();

        String pgVector = EmbeddingService.toPgVector(queryVector);
        List<Object[]> rows = embeddingRepo.findNearestQueryPatterns(pgVector, topK);
        return mapResults(rows);
    }

    /**
     * Build a selective context string from vector search results.
     * Used by LocalLlmStrategy instead of dumping the full catalog.
     */
    public String buildContextFromResults(List<VectorSearchResult> results) {
        if (results.isEmpty()) return "";

        StringBuilder sb = new StringBuilder("RELEVANT CONTEXT (from semantic search):\n\n");

        // Group by entity type
        Map<String, List<VectorSearchResult>> grouped = new LinkedHashMap<>();
        for (var r : results) {
            grouped.computeIfAbsent(r.entityType(), k -> new ArrayList<>()).add(r);
        }

        for (var entry : grouped.entrySet()) {
            sb.append(entry.getKey()).append("S:\n");
            for (var r : entry.getValue()) {
                sb.append("  - ").append(r.contentText());
                sb.append(" [similarity: ").append(String.format("%.2f", r.similarity())).append("]");
                sb.append("\n");
            }
            sb.append("\n");
        }

        return sb.toString();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INDEXING — Embed entities from the catalog into pgvector
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Sync all entities from the catalog into the embedding table.
     * Called on startup and periodically when the catalog refreshes.
     */
    @Transactional
    public void syncCatalogEmbeddings(NlpCatalogResponse catalog) {
        if (!isVectorSearchReady()) {
            log.info("Embedding service not available, skipping catalog sync");
            return;
        }

        LocalDateTime syncStart = LocalDateTime.now();
        int total = 0;

        try {
            // Resources
            if (catalog.resourceDetails() != null) {
                for (var r : catalog.resourceDetails()) {
                    String text = String.format("%s | Role: %s | Location: %s | Pod: %s | Rate: %s | FTE: %s",
                            r.name(), r.role(), r.location(),
                            r.podName() != null ? r.podName() : "Unassigned",
                            r.billingRate(), r.fte());
                    String meta = toJson(Map.of("role", r.role(), "location", r.location(),
                            "pod", r.podName() != null ? r.podName() : ""));
                    upsertEmbedding("RESOURCE", r.id(), r.name(), text, null, null, meta, "CATALOG");
                    total++;
                }
            }

            // Projects
            if (catalog.projectDetails() != null) {
                for (var p : catalog.projectDetails()) {
                    String text = String.format("%s | Priority: %s | Owner: %s | Status: %s | Pods: %s | Timeline: %s",
                            p.name(), p.priority(), p.owner(), p.status(),
                            p.assignedPods() != null ? p.assignedPods() : "None",
                            p.timeline() != null ? p.timeline() : "N/A");
                    String meta = toJson(Map.of("priority", p.priority(), "owner", p.owner(),
                            "status", p.status()));
                    upsertEmbedding("PROJECT", p.id(), p.name(), text, null, null, meta, "CATALOG");
                    total++;
                }
            }

            // Pods
            if (catalog.podDetails() != null) {
                for (var p : catalog.podDetails()) {
                    String text = String.format("%s | Members: %d (%s) | Projects: %s | BAU: %s",
                            p.name(), p.memberCount(),
                            String.join(", ", p.members()),
                            String.join(", ", p.projectNames()),
                            p.avgBauPct());
                    String meta = toJson(Map.of("memberCount", p.memberCount(),
                            "projectCount", p.projectCount()));
                    upsertEmbedding("POD", p.id(), p.name(), text, null, null, meta, "CATALOG");
                    total++;
                }
            }

            // Sprints
            if (catalog.sprintDetails() != null) {
                for (var s : catalog.sprintDetails()) {
                    String text = String.format("%s | %s to %s | Status: %s",
                            s.name(), s.startDate(), s.endDate(), s.status());
                    upsertEmbedding("SPRINT", null, s.name(), text, null, null, null, "CATALOG");
                    total++;
                }
            }

            // Releases
            if (catalog.releaseDetails() != null) {
                for (var r : catalog.releaseDetails()) {
                    String text = String.format("%s | Release: %s | Freeze: %s | Type: %s",
                            r.name(), r.releaseDate(), r.codeFreezeDate(), r.type());
                    upsertEmbedding("RELEASE", null, r.name(), text, null, null, null, "CATALOG");
                    total++;
                }
            }

            // Cost rates
            if (catalog.costRates() != null) {
                for (var cr : catalog.costRates()) {
                    String text = String.format("Cost rate: %s in %s = $%s/hr",
                            cr.role(), cr.location(), cr.hourlyRate());
                    String meta = toJson(Map.of("role", cr.role(), "location", cr.location()));
                    upsertEmbedding("COST_RATE", null, cr.role() + " " + cr.location(),
                            text, null, null, meta, "CATALOG");
                    total++;
                }
            }

            // Deactivate embeddings that weren't updated in this sync
            embeddingRepo.deactivateStale("RESOURCE", syncStart);
            embeddingRepo.deactivateStale("PROJECT", syncStart);
            embeddingRepo.deactivateStale("POD", syncStart);

            log.info("Catalog embeddings synced: {} entities embedded", total);

        } catch (Exception e) {
            log.error("Failed to sync catalog embeddings: {}", e.getMessage(), e);
        }
    }

    /**
     * Embed a successful query→intent pair (called by the learner).
     */
    @Transactional
    public void embedQueryPattern(String queryText, String intent, String route,
                                   double confidence, String source) {
        if (!isVectorSearchReady()) return;

        try {
            String meta = toJson(Map.of("confidence", confidence));
            upsertEmbedding("QUERY_PATTERN", null, queryText, queryText,
                    intent, route, meta, source);
            log.debug("Embedded query pattern: '{}' → {}", queryText, intent);
        } catch (Exception e) {
            log.warn("Failed to embed query pattern: {}", e.getMessage());
        }
    }

    /**
     * Get embedding statistics (for the NLP Optimizer dashboard).
     */
    public Map<String, Long> getEmbeddingStats() {
        Map<String, Long> stats = new LinkedHashMap<>();
        try {
            List<Object[]> counts = embeddingRepo.countByEntityType();
            for (Object[] row : counts) {
                stats.put((String) row[0], (Long) row[1]);
            }
            stats.put("_pgvectorAvailable", isPgvectorAvailable() ? 1L : 0L);
        } catch (Exception e) {
            log.debug("Could not fetch embedding stats: {}", e.getMessage());
            stats.put("_pgvectorAvailable", 0L);
        }
        return stats;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal helpers
    // ═══════════════════════════════════════════════════════════════════════════

    private void upsertEmbedding(String entityType, Long entityId, String entityName,
                                  String contentText, String intent, String route,
                                  String metadata, String source) {
        float[] vector = embeddingService.embed(contentText);
        if (vector == null) return;

        String pgVector = EmbeddingService.toPgVector(vector);

        // Check if this entity already has an embedding
        if (entityId != null) {
            List<NlpEmbedding> existing = embeddingRepo.findByEntityTypeAndEntityId(entityType, entityId);
            if (!existing.isEmpty()) {
                embeddingRepo.updateVector(existing.get(0).getId(), contentText, pgVector, metadata);
                return;
            }
        }

        embeddingRepo.insertWithVector(entityType, entityId, entityName, contentText,
                pgVector, intent, route, metadata, source, 1.0, true);
    }

    private String toJson(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }

    private List<VectorSearchResult> mapResults(List<Object[]> rows) {
        List<VectorSearchResult> results = new ArrayList<>();
        for (Object[] row : rows) {
            try {
                results.add(new VectorSearchResult(
                        ((Number) row[0]).longValue(),               // id
                        (String) row[1],                             // entity_type
                        row[2] != null ? ((Number) row[2]).longValue() : null,  // entity_id
                        (String) row[3],                             // entity_name
                        (String) row[4],                             // content_text
                        (String) row[5],                             // intent
                        (String) row[6],                             // route
                        (String) row[7],                             // metadata
                        (String) row[8],                             // source
                        row[9] != null ? ((Number) row[9]).doubleValue() : 1.0,  // confidence
                        row[13] != null ? ((Number) row[13]).doubleValue() : 1.0  // distance
                ));
            } catch (Exception e) {
                log.warn("Failed to map embedding row: {}", e.getMessage());
            }
        }
        return results;
    }
}
