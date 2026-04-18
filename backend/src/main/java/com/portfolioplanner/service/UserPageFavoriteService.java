package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.UserPageFavorite;
import com.portfolioplanner.domain.repository.UserPageFavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Business logic for per-user page favorites (starred pages).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserPageFavoriteService {

    private final UserPageFavoriteRepository repo;

    /**
     * Returns all favorites for the given user, ordered by sortOrder then createdAt.
     */
    public List<UserPageFavorite> listForUser(String username) {
        return repo.findByUsernameOrderBySortOrderAscCreatedAtAsc(username);
    }

    /**
     * Adds a favorite. Idempotent: if the path is already favorited, returns the existing record.
     */
    @Transactional
    public UserPageFavorite addFavorite(String username, String pagePath, String pageLabel) {
        Optional<UserPageFavorite> existing = repo.findByUsernameAndPagePath(username, pagePath);
        if (existing.isPresent()) {
            return existing.get();
        }
        UserPageFavorite fav = new UserPageFavorite();
        fav.setUsername(username);
        fav.setPagePath(pagePath);
        fav.setPageLabel(pageLabel);
        // New items go to the end of the sort order
        long count = repo.findByUsernameOrderBySortOrderAscCreatedAtAsc(username).size();
        fav.setSortOrder((int) count);
        return repo.save(fav);
    }

    /**
     * Removes a favorite by path. No-op if not found.
     */
    @Transactional
    public void removeFavorite(String username, String pagePath) {
        repo.deleteByUsernameAndPagePath(username, pagePath);
    }

    /**
     * Updates sort order for a list of (pagePath → sortOrder) mappings.
     */
    @Transactional
    public void reorder(String username, List<ReorderItem> items) {
        for (ReorderItem item : items) {
            repo.findByUsernameAndPagePath(username, item.pagePath())
                    .ifPresent(fav -> {
                        fav.setSortOrder(item.sortOrder());
                        repo.save(fav);
                    });
        }
    }

    /**
     * Simple value object for reorder payloads (mirrors the controller DTO).
     */
    public record ReorderItem(String pagePath, int sortOrder) {}
}
