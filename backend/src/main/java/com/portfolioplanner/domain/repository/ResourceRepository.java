package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Resource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResourceRepository extends JpaRepository<Resource, Long> {

    List<Resource> findByActiveTrue();

    List<Resource> findByActiveTrueAndCountsInCapacityTrue();
}
