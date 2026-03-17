package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraPod;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JiraPodRepository extends JpaRepository<JiraPod, Long> {

    /** All enabled PODs ordered by sort_order then display name — used by the dashboard. */
    List<JiraPod> findByEnabledTrueOrderBySortOrderAscPodDisplayNameAsc();

    /** All PODs (enabled + disabled) ordered for the settings page. */
    List<JiraPod> findAllByOrderBySortOrderAscPodDisplayNameAsc();
}
