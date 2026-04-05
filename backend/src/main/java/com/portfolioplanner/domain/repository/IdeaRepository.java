package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Idea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IdeaRepository extends JpaRepository<Idea, Long> {
    List<Idea> findAllByOrderByVotesDescCreatedAtDesc();
    List<Idea> findByStatusOrderByVotesDescCreatedAtDesc(String status);
}
