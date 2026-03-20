package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.PagePermission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PagePermissionRepository extends JpaRepository<PagePermission, Long> {

    List<PagePermission> findByRole(String role);

    Optional<PagePermission> findByRoleAndPageKey(String role, String pageKey);

    List<PagePermission> findByRoleAndAllowedTrue(String role);
}
