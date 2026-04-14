# Code Review Summary

## Critical issues

- `JiraCommentSyncHelper.replaceComments(...)` does not reliably make per-comment failures safe. The code catches `Exception` around `commentRepo.save(...)`, but JPA/Hibernate commonly surfaces constraint violations on flush or transaction commit rather than at `save()`. After a persistence exception, the transaction is often marked rollback-only and the persistence context is unsafe to continue using. One bad comment can therefore still roll back the entire `REQUIRES_NEW` transaction, so the implementation does not reliably satisfy its stated "skip one bad comment and continue" behavior.

## Medium issues

- `JiraIssueSyncService.syncIssueComments(...)` now skips `replaceComments(...)` when `commentData` is empty. If Jira reports comments but all parsed comments are filtered out, unparsable, or unavailable after fallback failure, existing rows are not deleted. That can leave stale comments in the database indefinitely.
- Partial-fetch failure behavior is inconsistent. When inline comments are incomplete and `jiraClient.getComments(issueKey)` fails, the code falls back to whatever partial set is available. Combined with the new `if (!commentData.isEmpty())` guard, the sync may either preserve stale comments or replace the issue with a partial set depending on what Jira returned inline. That makes operational behavior hard to reason about.

## Minor issues

- `JiraIssueSyncService` still injects `JiraIssueCommentRepository commentRepo`, but it is no longer used after the refactor.
- `JiraCommentSyncHelper` imports `java.util.Map` but does not use it.
- The repository currently has no test files under `src/test`, which is not enough coverage for transaction-boundary behavior this subtle.

## Suggested fixes

- Align the transaction strategy with the intended behavior:
  - If comment replacement should be atomic per issue, keep one `REQUIRES_NEW` transaction for the whole issue, remove the per-comment `try/catch`, and let the entire comment replacement roll back cleanly on any failure.
  - If the requirement is truly "skip only the bad comment", isolate each save in its own transaction or force failure visibility with `saveAndFlush` or `entityManager.flush()` inside a smaller boundary, then clear the persistence context after failures.
- Define one explicit policy for empty or failed comment fetches:
  - If the Jira snapshot is authoritative, always call `replaceComments(issueKey, parsedComments)` even when the parsed list is empty.
  - If a failed fetch means the snapshot is untrustworthy, skip replacement entirely and log that decision clearly.
- Remove the unused `commentRepo` field from `JiraIssueSyncService`.
- Remove the unused `Map` import from `JiraCommentSyncHelper`.
- Consider making flush behavior explicit in the helper so correctness does not depend on deferred JPA timing.

## Tests to add

- Integration test covering a duplicate `comment_jira_id` during comment sync and verifying the outer issue-sync flow continues to work, including worklog sync.
- Integration test for the intended bad-comment contract:
  - If issue-level atomicity is desired, no comments should be replaced for that issue after one invalid row.
  - If per-comment tolerance is desired, valid comments should persist and the invalid one should be skipped.
- Integration test verifying that an authoritative empty Jira comment set deletes previously stored comments.
- Integration test verifying deterministic behavior when inline comments are incomplete and `getComments(issueKey)` fails.
- Unit or integration test covering long comment truncation and ADF body parsing.
