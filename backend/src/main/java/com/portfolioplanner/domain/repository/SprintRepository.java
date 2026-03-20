package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SprintRepository extends JpaRepository<Sprint, Long> {
    List<Sprint> findAllByOrderByStartDateAsc();
}
