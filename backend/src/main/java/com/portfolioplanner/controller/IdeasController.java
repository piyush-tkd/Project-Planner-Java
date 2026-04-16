package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Idea;
import com.portfolioplanner.domain.repository.IdeaRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;


@RestController
@RequestMapping("/api/ideas")
@RequiredArgsConstructor
public class IdeasController {

    private final IdeaRepository repo;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record IdeaResponse(
        Long   id,
        String title,
        String description,
        String submitterName,
        String status,
        int    votes,
        String tags,           // comma-separated string, matching how the entity stores it
        String estimatedEffort,
        Long   linkedProjectId,
        String createdAt,
        String attachmentUrl,
        String attachmentName,
        String attachmentType
    ) {}

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

    // ── Mappings ─────────────────────────────────────────────────────────────

    private IdeaResponse toDto(Idea idea) {
        return new IdeaResponse(
            idea.getId(),
            idea.getTitle(),
            idea.getDescription(),
            idea.getSubmitterName(),
            idea.getStatus(),
            idea.getVotes(),
            idea.getTags(),   // return raw comma-separated string; null if no tags set
            idea.getEstimatedEffort(),
            idea.getLinkedProjectId(),
            idea.getCreatedAt() != null ? idea.getCreatedAt().toString() : null,
            idea.getAttachmentUrl(),
            idea.getAttachmentName(),
            idea.getAttachmentType()
        );
    }

    private void applyRequest(Idea entity, IdeaRequest req) {
        entity.setTitle(req.title());
        if (req.description()     != null) entity.setDescription(req.description());
        if (req.submitterName()   != null) entity.setSubmitterName(req.submitterName());
        if (req.status()          != null) entity.setStatus(req.status().toUpperCase());
        if (req.tags()            != null) entity.setTags(req.tags());
        if (req.estimatedEffort() != null) entity.setEstimatedEffort(req.estimatedEffort().toUpperCase());
        if (req.linkedProjectId() != null) entity.setLinkedProjectId(req.linkedProjectId());
        // Attachment fields (explicit null means "clear"; use sentinel logic instead)
        entity.setAttachmentUrl(req.attachmentUrl());
        entity.setAttachmentName(req.attachmentName());
        entity.setAttachmentType(req.attachmentType());
    }

    // ── Endpoints ────────────────────────────────────────────────────────────

    @GetMapping
    public List<IdeaResponse> getAll(@RequestParam(required = false) String status) {
        if (status != null && !status.isBlank())
            return repo.findByStatusOrderByVotesDescCreatedAtDesc(status.toUpperCase())
                       .stream().map(this::toDto).toList();
        return repo.findAllByOrderByVotesDescCreatedAtDesc()
                   .stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public IdeaResponse getById(@PathVariable Long id) {
        return repo.findById(id).map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Idea not found"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<IdeaResponse> create(@Valid @RequestBody IdeaRequest req) {
        Idea entity = new Idea();
        entity.setStatus("SUBMITTED");
        entity.setVotes(0);
        applyRequest(entity, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(repo.save(entity)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public IdeaResponse update(@PathVariable Long id, @Valid @RequestBody IdeaRequest req) {
        Idea entity = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Idea not found"));
        applyRequest(entity, req);
        return toDto(repo.save(entity));
    }

    /** Increment (upvote=true) or decrement (upvote=false) the vote count */
    @PatchMapping("/{id}/vote")
    public IdeaResponse vote(@PathVariable Long id, @RequestBody VoteRequest req) {
        Idea entity = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Idea not found"));
        entity.setVotes(Math.max(0, entity.getVotes() + (req.upvote() ? 1 : -1)));
        return toDto(repo.save(entity));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Idea not found");
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
