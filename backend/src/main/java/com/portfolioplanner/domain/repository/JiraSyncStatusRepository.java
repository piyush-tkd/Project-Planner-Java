package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraSyncStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraSyncStatusRepository extends JpaRepository<JiraSyncStatus, Long> {

    Optional<JiraSyncStatus> findByProjectKeyAndBoardType(String projectKey, String boardType);

    List<JiraSyncStatus> findAllByOrderByProjectKeyAsc();

    List<JiraSyncStatus> findByStatus(String status);
}
