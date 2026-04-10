package com.portfolioplanner.service.jira;

import com.portfolioplanner.domain.model.JiraIssueComment;
import com.portfolioplanner.domain.repository.JiraIssueCommentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Runs comment upserts in their own REQUIRES_NEW transaction so that a
 * constraint violation (e.g. duplicate comment_jira_id) or any other save
 * failure rolls back only the sub-transaction, leaving the caller's Hibernate
 * session clean and usable.
 *
 * Background: JiraIssueSyncService processes all issues in a single outer
 * transaction. If a commentRepo.save() throws inside that transaction, Hibernate
 * marks the session rollback-only and every subsequent DB call – including
 * worklog sync – fails with "null id in JiraIssueComment entry". Isolating
 * comment saves in REQUIRES_NEW prevents session poisoning.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JiraCommentSyncHelper {

    private final JiraIssueCommentRepository commentRepo;

    /**
     * Deletes existing comments for the issue and saves the new ones,
     * all inside an independent transaction.
     *
     * @param issueKey  Jira issue key (e.g. DDPLIS-1226)
     * @param comments  Parsed comment maps ready to be persisted
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void replaceComments(String issueKey, List<CommentData> comments) {
        commentRepo.deleteByIssueKey(issueKey);
        int saved = 0;
        for (CommentData d : comments) {
            try {
                commentRepo.save(new JiraIssueComment(
                        d.commentJiraId(),
                        issueKey,
                        d.authorAccountId(),
                        d.authorDisplayName(),
                        d.body(),
                        d.created(),
                        d.updated()
                ));
                saved++;
            } catch (Exception e) {
                // Log and skip this one comment — don't let it poison the session.
                log.warn("  Skipped comment {} for {}: {}", d.commentJiraId(), issueKey, e.getMessage());
            }
        }
        log.debug("  Saved {}/{} comments for {}", saved, comments.size(), issueKey);
    }

    /** Plain data carrier so JiraIssueSyncService can pass parsed comment fields. */
    public record CommentData(
            String commentJiraId,
            String authorAccountId,
            String authorDisplayName,
            String body,
            LocalDateTime created,
            LocalDateTime updated
    ) {}
}
