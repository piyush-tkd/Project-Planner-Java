package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AppChangelog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AppChangelogRepository extends JpaRepository<AppChangelog, Long> {
    List<AppChangelog> findByPublishedTrueOrderByCreatedAtDesc();
    List<AppChangelog> findAllByOrderByCreatedAtDesc();
    long countByPublishedTrueAndCreatedAtAfter(LocalDateTime since);
}
