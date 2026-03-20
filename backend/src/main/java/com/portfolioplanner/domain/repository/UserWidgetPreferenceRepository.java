package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.UserWidgetPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserWidgetPreferenceRepository extends JpaRepository<UserWidgetPreference, Long> {

    Optional<UserWidgetPreference> findByUsernameAndPageKey(String username, String pageKey);
}
