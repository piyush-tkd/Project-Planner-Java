package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.BauAssumption;
import com.portfolioplanner.domain.model.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BauAssumptionRepository extends JpaRepository<BauAssumption, Long> {

    List<BauAssumption> findByPodId(Long podId);

    Optional<BauAssumption> findByPodIdAndRole(Long podId, Role role);
}
