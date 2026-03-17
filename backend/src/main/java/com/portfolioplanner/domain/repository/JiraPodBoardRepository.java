package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraPodBoard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JiraPodBoardRepository extends JpaRepository<JiraPodBoard, Long> {

    Optional<JiraPodBoard> findByJiraProjectKey(String jiraProjectKey);

    List<JiraPodBoard> findByPodId(Long podId);
}
