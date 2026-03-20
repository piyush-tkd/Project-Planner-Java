package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraSupportBoard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JiraSupportBoardRepository extends JpaRepository<JiraSupportBoard, Long> {
    List<JiraSupportBoard> findByEnabledTrue();
}
