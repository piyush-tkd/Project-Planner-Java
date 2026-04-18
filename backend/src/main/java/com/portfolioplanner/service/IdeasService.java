package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Idea;
import com.portfolioplanner.domain.repository.IdeaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IdeasService {

    private final IdeaRepository repo;

    /** Inner response record used by the controller. */
    public record IdeaResponse(
        Long id,
        String title,
        String description,
        String submitterName,
        String status,
        Integer votes,
        String tags,
        String estimatedEffort,
        Long linkedProjectId,
        String attachmentUrl,
        String attachmentName,
        String attachmentType,
        String createdAt,
        String updatedAt
    ) {}

    // ── Queries ───────────────────────────────────────────────────────────────

    public List<IdeaResponse> getAll(String status) {
        List<Idea> ideas = (status != null && !status.isBlank())
            ? repo.findByStatusOrderByVotesDescCreatedAtDesc(status)
            : repo.findAllByOrderByVotesDescCreatedAtDesc();
        return ideas.stream().map(this::toResponse).collect(Collectors.toList());
    }

    public IdeaResponse getById(Long id) {
        return repo.findById(id)
            .map(this::toResponse)
            .orElseThrow(() -> new RuntimeException("Idea not found: " + id));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public IdeaResponse create(String title, String description, String submitterName,
                               String status, String tags, String estimatedEffort,
                               Long linkedProjectId, String attachmentUrl,
                               String attachmentName, String attachmentType) {
        Idea idea = new Idea();
        idea.setTitle(title);
        idea.setDescription(description);
        idea.setSubmitterName(submitterName);
        idea.setStatus(status != null ? status : "SUBMITTED");
        idea.setTags(tags);
        idea.setEstimatedEffort(estimatedEffort);
        idea.setLinkedProjectId(linkedProjectId);
        idea.setAttachmentUrl(attachmentUrl);
        idea.setAttachmentName(attachmentName);
        idea.setAttachmentType(attachmentType);
        return toResponse(repo.save(idea));
    }

    @Transactional
    public IdeaResponse update(Long id, String title, String description, String submitterName,
                               String status, String tags, String estimatedEffort,
                               Long linkedProjectId, String attachmentUrl,
                               String attachmentName, String attachmentType) {
        Idea idea = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Idea not found: " + id));
        idea.setTitle(title);
        idea.setDescription(description);
        idea.setSubmitterName(submitterName);
        if (status != null) idea.setStatus(status);
        idea.setTags(tags);
        idea.setEstimatedEffort(estimatedEffort);
        idea.setLinkedProjectId(linkedProjectId);
        idea.setAttachmentUrl(attachmentUrl);
        idea.setAttachmentName(attachmentName);
        idea.setAttachmentType(attachmentType);
        return toResponse(repo.save(idea));
    }

    @Transactional
    public IdeaResponse vote(Long id, boolean upvote) {
        Idea idea = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Idea not found: " + id));
        int current = idea.getVotes() != null ? idea.getVotes() : 0;
        idea.setVotes(upvote ? current + 1 : Math.max(0, current - 1));
        return toResponse(repo.save(idea));
    }

    @Transactional
    public void delete(Long id) {
        repo.deleteById(id);
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private IdeaResponse toResponse(Idea i) {
        return new IdeaResponse(
            i.getId(),
            i.getTitle(),
            i.getDescription(),
            i.getSubmitterName(),
            i.getStatus(),
            i.getVotes(),
            i.getTags(),
            i.getEstimatedEffort(),
            i.getLinkedProjectId(),
            i.getAttachmentUrl(),
            i.getAttachmentName(),
            i.getAttachmentType(),
            i.getCreatedAt() != null ? i.getCreatedAt().toString() : null,
            i.getUpdatedAt() != null ? i.getUpdatedAt().toString() : null
        );
    }
}
