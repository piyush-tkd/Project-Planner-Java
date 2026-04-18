package com.portfolioplanner.controller;

import com.portfolioplanner.service.IdeasService;
import com.portfolioplanner.service.IdeasService.IdeaResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/ideas")
@RequiredArgsConstructor
public class IdeasController {

    private final IdeasService service;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record IdeaRequest(
        @NotBlank String title,
        String description,
        String submitterName,
        String status,
        String tags,           // comma-separated
        String estimatedEffort,
        Long   linkedProjectId,
        String attachmentUrl,
        String attachmentName,
        String attachmentType
    ) {}

    public record VoteRequest(boolean upvote) {}

    // ── Endpoints ────────────────────────────────────────────────────────────

    @GetMapping
    public List<IdeaResponse> getAll(@RequestParam(required = false) String status) {
        return service.getAll(status);
    }

    @GetMapping("/{id}")
    public IdeaResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<IdeaResponse> create(@Valid @RequestBody IdeaRequest req) {
        IdeaResponse response = service.create(req.title(), req.description(), req.submitterName(),
                                               req.status(), req.tags(), req.estimatedEffort(),
                                               req.linkedProjectId(), req.attachmentUrl(),
                                               req.attachmentName(), req.attachmentType());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public IdeaResponse update(@PathVariable Long id, @Valid @RequestBody IdeaRequest req) {
        return service.update(id, req.title(), req.description(), req.submitterName(),
                             req.status(), req.tags(), req.estimatedEffort(),
                             req.linkedProjectId(), req.attachmentUrl(),
                             req.attachmentName(), req.attachmentType());
    }

    /** Increment (upvote=true) or decrement (upvote=false) the vote count */
    @PatchMapping("/{id}/vote")
    public IdeaResponse vote(@PathVariable Long id, @RequestBody VoteRequest req) {
        return service.vote(id, req.upvote());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
