package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsername(String username);
    Optional<AppUser> findByEmail(String email);
    Optional<AppUser> findByEmailIgnoreCase(String email);
    /** All enabled users with the given role — used to notify reviewers. */
    List<AppUser> findByRoleAndEnabledTrue(String role);
}
