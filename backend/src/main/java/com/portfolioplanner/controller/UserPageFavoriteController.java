package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.UserPageFavorite;
import com.portfolioplanner.service.UserPageFavoriteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * REST API for per-user page favorites (starred pages).
 *
 * GET    /api/favorites               → list current user's favorites
 * POST   /api/favorites               → add a favorite  { pagePath, pageLabel }
 * DELETE /api/favorites?path=...      → remove a favorite by path
 * PUT    /api/favorites/reorder       → update sort order  [{ pagePath, sortOrder }]
 */
@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class UserPageFavoriteController {

    private final UserPageFavoriteService favoriteService;

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
        return favoriteService.listForUser(auth.getName())
                .stream().map(FavoriteDto::from).collect(Collectors.toList());
    }

    // ── POST /api/favorites ───────────────────────────────────────────────────

    @PostMapping
    public FavoriteDto add(@RequestBody AddRequest req, Authentication auth) {
        return FavoriteDto.from(
                favoriteService.addFavorite(auth.getName(), req.pagePath(), req.pageLabel()));
    }

    // ── DELETE /api/favorites?path=... ────────────────────────────────────────

    @DeleteMapping
    public ResponseEntity<Void> remove(@RequestParam String path, Authentication auth) {
        favoriteService.removeFavorite(auth.getName(), path);
        return ResponseEntity.noContent().build();
    }

    // ── PUT /api/favorites/reorder ────────────────────────────────────────────

    @PutMapping("/reorder")
    public ResponseEntity<Void> reorder(@RequestBody List<ReorderItem> items, Authentication auth) {
        favoriteService.reorder(
                auth.getName(),
                items.stream()
                        .map(i -> new UserPageFavoriteService.ReorderItem(i.pagePath(), i.sortOrder()))
                        .collect(Collectors.toList()));
        return ResponseEntity.ok().build();
    }
}
