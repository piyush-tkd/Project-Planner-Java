package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.DashboardWidget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DashboardWidgetRepository extends JpaRepository<DashboardWidget, Long> {
    List<DashboardWidget> findByUsernameOrderByGridRowAscGridColAsc(String username);
    void deleteByUsername(String username);
}
