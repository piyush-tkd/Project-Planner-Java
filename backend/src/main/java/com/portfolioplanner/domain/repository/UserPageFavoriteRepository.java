package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.UserPageFavorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserPageFavoriteRepository extends JpaRepository<UserPageFavorite, Long> {

    List<UserPageFavorite> findByUsernameOrderBySortOrderAscCreatedAtAsc(String username);

    Optional<UserPageFavorite> findByUsernameAndPagePath(String username, String pagePath);

    boolean existsByUsernameAndPagePath(String username, String pagePath);

    void deleteByUsernameAndPagePath(String username, String pagePath);
}
