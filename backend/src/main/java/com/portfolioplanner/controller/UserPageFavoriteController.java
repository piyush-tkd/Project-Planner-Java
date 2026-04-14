package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.UserPageFavorite;
import com.portfolioplanner.domain.repository.UserPageFavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * REST API for per-user page favorites (starred pages).
 *
 * GET    /api/favorites              → list current user's favorites
 * POST   /api/favorites              → add a favorite  { pagePath, pageLabel }
 * DELETE /api/favorites/{encodedPath} → remove a favorite by path
 * PUT    /api/favorites/reorder      → update sort order  [{ pagePath, sortOrder }]
 */
@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class UserPageFavoriteController {

    private final UserPageFavoriteRepository repo;

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record FavoriteDto(Long id, String pagePath, String pageLabel, int sortOrder) {
        static FavoriteDto from(UserPageFavorite f) {
            return new FavoriteDto(f.getId(), f.getPagePath(), f.getPageLabel(), f.getSortOrder());
        }
    }

    public record AddRequest(String pagePath, String pageLabel) {}

    public record ReorderItem(String pagePath, int sortOrder) {}

    // ── GET /api/favorites ────────────────────────────────────────────────────

    @GetMapping
    public List<FavoriteDto> list(Authentication auth) {
        String username = auth.getName();
        return repo.findByUsernameOrderBySortOrderAscCreatedAtAsc(username)
                .stream().map(FavoriteDto::from).collect(Collectors.toList());
    }

    // ── POST /api/favorites ───────────────────────────────────────────────────

    @PostMapping
    @Transactional
    public FavoriteDto add(@RequestBody AddRequest req, Authentication auth) {
        String username = auth.getName();
        // Idempotent: if already favorited, just return existing
        return repo.findByUsernameAndPagePath(username, req.pagePath())
                .map(FavoriteDto::from)
                .orElseGet(() -> {
                    UserPageFavorite fav = new UserPageFavorite();
                    fav.setUsername(username);
                    fav.setPagePath(req.pagePath());
                    fav.setPageLabel(req.pageLabel());
                    // Sort order = current count so new items go to end
                    long count = repo.findByUsernameOrderBySortOrderAscCreatedAtAsc(username).size();
                    fav.setSortOrder((int) count);
                    return FavoriteDto.from(repo.save(fav));
                });
    }

    // ── DELETE /api/favorites?path=... ────────────────────────────────────────

    @DeleteMapping
    @Transactional
    public ResponseEntity<Void> remove(@RequestParam String path, Authentication auth) {
        String username = auth.getName();
        repo.deleteByUsernameAndPagePath(username, path);
        return ResponseEntity.noContent().build();
    }

    // ── PUT /api/favorites/reorder ────────────────────────────────────────────

    @PutMapping("/reorder")
    @Transactional
    public ResponseEntity<Void> reorder(@RequestBody List<ReorderItem> items, Authentication auth) {
        String username = auth.getName();
        for (ReorderItem item : items) {
            repo.findByUsernameAndPagePath(username, item.pagePath())
                    .ifPresent(fav -> {
                        fav.setSortOrder(item.sortOrder());
                        repo.save(fav);
                    });
        }
        return ResponseEntity.ok().build();
    }
}
