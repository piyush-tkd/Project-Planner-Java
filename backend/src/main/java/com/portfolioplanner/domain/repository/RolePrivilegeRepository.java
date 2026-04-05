package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.RolePrivilege;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RolePrivilegeRepository extends JpaRepository<RolePrivilege, Long> {

    List<RolePrivilege> findByRole(String role);

    List<RolePrivilege> findByRoleAndSectionKey(String role, String sectionKey);

    Optional<RolePrivilege> findByRoleAndSectionKeyAndPageKeyAndTabKey(
            String role, String sectionKey, String pageKey, String tabKey);
}
