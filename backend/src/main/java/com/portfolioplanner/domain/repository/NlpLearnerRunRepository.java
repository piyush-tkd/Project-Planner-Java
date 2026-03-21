package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NlpLearnerRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NlpLearnerRunRepository extends JpaRepository<NlpLearnerRun, Long> {

    List<NlpLearnerRun> findAllByOrderByRunAtDesc();
}
