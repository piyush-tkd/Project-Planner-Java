package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.AppUser;
import com.portfolioplanner.domain.model.NlpLearnedPattern;
import com.portfolioplanner.domain.model.NlpLearnerRun;
import com.portfolioplanner.domain.model.NlpQueryLog;
import com.portfolioplanner.domain.repository.AppUserRepository;
import com.portfolioplanner.dto.request.NlpConfigRequest;
import com.portfolioplanner.dto.request.NlpQueryRequest;
import com.portfolioplanner.dto.response.NlpCatalogResponse;
import com.portfolioplanner.dto.response.NlpConfigResponse;
import com.portfolioplanner.dto.response.NlpQueryResponse;
import com.portfolioplanner.service.nlp.NlpCatalogService;
import com.portfolioplanner.service.nlp.NlpConfigService;
import com.portfolioplanner.service.nlp.NlpEmbeddingSyncService;
import com.portfolioplanner.service.nlp.NlpLearnerService;
import com.portfolioplanner.service.nlp.NlpService;
import com.portfolioplanner.service.nlp.NlpVectorSearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/nlp")
@RequiredArgsConstructor
public class NlpController {

    private final NlpService nlpService;
    private final NlpCatalogService catalogService;
    private final NlpConfigService configService;
    private final NlpLearnerService learnerService;
    private final NlpEmbeddingSyncService embeddingSyncService;
    private final NlpVectorSearchService vectorSearchService;
    private final AppUserRepository userRepo;

    /** Process a natural language query. */
    @PostMapping("/query")
    public ResponseEntity<NlpQueryResponse> query(@Valid @RequestBody NlpQueryRequest request,
                                                   Authentication auth) {
        Long userId = resolveUserId(auth);
        NlpQueryResponse response = nlpService.query(request.query(), userId);
        return ResponseEntity.ok(response);
    }

    /** Get the entity catalog (for autocomplete and LLM context). */
    @GetMapping("/catalog")
    public ResponseEntity<NlpCatalogResponse> getCatalog() {
        return ResponseEntity.ok(catalogService.getCatalog());
    }

    /** Get NLP configuration (admin). */
    @GetMapping("/config")
    public ResponseEntity<NlpConfigResponse> getConfig() {
        return ResponseEntity.ok(configService.getConfig());
    }

    /** Update NLP configuration (admin). */
    @PutMapping("/config")
    public ResponseEntity<NlpConfigResponse> updateConfig(@RequestBody NlpConfigRequest request) {
        return ResponseEntity.ok(configService.updateConfig(request));
    }

    /** Test a specific strategy's availability. */
    @PostMapping("/test-connection")
    public ResponseEntity<NlpConfigResponse> testConnection() {
        return ResponseEntity.ok(configService.getConfig());
    }

    // ── Feedback ───────────────────────────────────────────────────────────

    /** Submit thumbs-up / thumbs-down feedback on a query result. */
    @PostMapping("/feedback")
    public ResponseEntity<Void> submitFeedback(@RequestBody Map<String, Object> body) {
        Long queryLogId = ((Number) body.get("queryLogId")).longValue();
        short rating = ((Number) body.get("rating")).shortValue();
        String comment = body.get("comment") != null ? body.get("comment").toString() : null;
        String screenshot = body.get("screenshot") != null ? body.get("screenshot").toString() : null;
        learnerService.submitFeedback(queryLogId, rating, comment, screenshot);
        return ResponseEntity.ok().build();
    }

    /** Undo feedback — resets rating, comment, and screenshot within the undo window. */
    @PostMapping("/feedback/undo")
    public ResponseEntity<Void> undoFeedback(@RequestBody Map<String, Object> body) {
        Long queryLogId = ((Number) body.get("queryLogId")).longValue();
        learnerService.undoFeedback(queryLogId);
        return ResponseEntity.ok().build();
    }

    // ── Learner / Optimizer ────────────────────────────────────────────────

    /** Run the NLP learner analysis (admin). */
    @PostMapping("/learner/run")
    public ResponseEntity<NlpLearnerService.LearnerStats> runLearner() {
        return ResponseEntity.ok(learnerService.runLearner());
    }

    /** Get low-confidence query logs for admin review. */
    @GetMapping("/learner/low-confidence")
    public ResponseEntity<List<NlpQueryLog>> getLowConfidenceLogs() {
        return ResponseEntity.ok(learnerService.getLowConfidenceLogs());
    }

    /** Get negatively-rated query logs for admin review. */
    @GetMapping("/learner/negative-rated")
    public ResponseEntity<List<NlpQueryLog>> getNegativelyRatedLogs() {
        return ResponseEntity.ok(learnerService.getNegativelyRatedLogs());
    }

    /** Get all learned patterns. */
    @GetMapping("/learner/patterns")
    public ResponseEntity<List<NlpLearnedPattern>> getAllPatterns() {
        return ResponseEntity.ok(learnerService.getAllPatterns());
    }

    /** Toggle a learned pattern's active state. */
    @PutMapping("/learner/patterns/{id}/toggle")
    public ResponseEntity<NlpLearnedPattern> togglePattern(@PathVariable Long id) {
        return ResponseEntity.ok(learnerService.togglePattern(id));
    }

    /** Delete a learned pattern. */
    @DeleteMapping("/learner/patterns/{id}")
    public ResponseEntity<Void> deletePattern(@PathVariable Long id) {
        learnerService.deletePattern(id);
        return ResponseEntity.noContent().build();
    }

    /** Get learner run history for trend analysis. */
    @GetMapping("/learner/history")
    public ResponseEntity<List<NlpLearnerRun>> getRunHistory() {
        return ResponseEntity.ok(learnerService.getRunHistory());
    }

    // ── Embeddings / Vector Search ────────────────────────────────────────

    /** Trigger embedding sync (admin). */
    @PostMapping("/embeddings/sync")
    public ResponseEntity<Map<String, Object>> syncEmbeddings() {
        embeddingSyncService.syncNow();
        return ResponseEntity.ok(Map.of(
                "status", "synced",
                "stats", vectorSearchService.getEmbeddingStats()
        ));
    }

    /** Get embedding statistics (admin). */
    @GetMapping("/embeddings/stats")
    public ResponseEntity<Map<String, Long>> getEmbeddingStats() {
        return ResponseEntity.ok(vectorSearchService.getEmbeddingStats());
    }

    private Long resolveUserId(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        return userRepo.findByUsername(auth.getName())
                .map(AppUser::getId)
                .orElse(null);
    }
}
