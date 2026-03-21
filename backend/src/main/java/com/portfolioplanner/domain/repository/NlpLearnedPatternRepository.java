package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NlpLearnedPattern;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NlpLearnedPatternRepository extends JpaRepository<NlpLearnedPattern, Long> {

    List<NlpLearnedPattern> findByActiveTrueOrderByTimesSeenDesc();

    Optional<NlpLearnedPattern> findByQueryPatternAndPatternType(String queryPattern, String patternType);

    List<NlpLearnedPattern> findAllByOrderByUpdatedAtDesc();

    long countByActiveTrue();
}
