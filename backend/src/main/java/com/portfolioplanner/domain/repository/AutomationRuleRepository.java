package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AutomationRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AutomationRuleRepository extends JpaRepository<AutomationRule, Long> {

    List<AutomationRule> findAllByOrderByCreatedAtDesc();

    List<AutomationRule> findByEnabledTrueOrderByCreatedAtDesc();

    List<AutomationRule> findByTriggerEventAndEnabledTrue(String triggerEvent);
}
