package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Pod;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PodRepository extends JpaRepository<Pod, Long> {

    List<Pod> findByActiveTrueOrderByDisplayOrderAsc();

    Page<Pod> findByActiveTrue(Pageable pageable);

    @Query("SELECT COALESCE(MAX(p.displayOrder), 0) FROM Pod p")
    int findMaxDisplayOrder();
}
