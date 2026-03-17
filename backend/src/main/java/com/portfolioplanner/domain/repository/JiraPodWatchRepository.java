package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraPodWatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraPodWatchRepository extends JpaRepository<JiraPodWatch, Long> {
    List<JiraPodWatch> findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();
    List<JiraPodWatch> findAllByOrderBySortOrderAscPodDisplayNameAsc();
    Optional<JiraPodWatch> findByJiraProjectKey(String jiraProjectKey);
}
