package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Pod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PodRepository extends JpaRepository<Pod, Long> {

    List<Pod> findByActiveTrueOrderByDisplayOrderAsc();
}
