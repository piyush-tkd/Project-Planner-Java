package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.ProjectComment;
import com.portfolioplanner.domain.repository.ProjectCommentRepository;
import com.portfolioplanner.dto.ProjectCommentDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectCommentService {

    private final ProjectCommentRepository projectCommentRepository;

    public List<ProjectCommentDto> listForProject(Long projectId) {
        List<ProjectComment> roots = projectCommentRepository.findByProjectIdAndParentIdIsNullOrderByCreatedAtDesc(projectId);
        return roots.stream()
                .map(c -> toDto(c, true))
                .collect(Collectors.toList());
    }

    @Transactional
    public ProjectCommentDto create(Long projectId, ProjectCommentDto.Request request, String author) {
        String authorName = author != null ? author : "anonymous";

        ProjectComment comment = new ProjectComment();
        comment.setProjectId(projectId);
        comment.setParentId(request.getParentId());
        comment.setAuthor(authorName);
        comment.setBody(request.getBody() == null ? "" : request.getBody().trim());

        return toDto(projectCommentRepository.save(comment), false);
    }

    @Transactional
    public ProjectCommentDto edit(Long projectId, Long id, ProjectCommentDto.Request request) {
        ProjectComment comment = projectCommentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getProjectId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment does not belong to this project");
        }

        comment.setBody(request.getBody() == null ? "" : request.getBody().trim());
        return toDto(projectCommentRepository.save(comment), false);
    }

    @Transactional
    public void delete(Long projectId, Long id) {
        ProjectComment comment = projectCommentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getProjectId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment does not belong to this project");
        }

        projectCommentRepository.delete(comment);
    }

    private ProjectCommentDto toDto(ProjectComment c, boolean includeReplies) {
        List<ProjectCommentDto> replies = null;
        if (includeReplies && c.getParentId() == null) {
            replies = projectCommentRepository.findByParentIdOrderByCreatedAtAsc(c.getId())
                    .stream()
                    .map(r -> toDto(r, false))
                    .collect(Collectors.toList());
        }
        return new ProjectCommentDto(
                c.getId(),
                c.getProjectId(),
                c.getParentId(),
                c.getAuthor(),
                c.getBody(),
                c.isEdited(),
                c.getCreatedAt(),
                c.getUpdatedAt(),
                replies
        );
    }
}
