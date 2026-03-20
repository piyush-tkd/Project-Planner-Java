package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraPod;
import com.portfolioplanner.domain.model.JiraPodRelease;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface JiraPodReleaseRepository extends JpaRepository<JiraPodRelease, Long> {

    /** All release versions configured for a given POD, sorted alphabetically. */
    List<JiraPodRelease> findByPodOrderByVersionNameAsc(JiraPod pod);

    /** Removes all release versions for a POD — used before re-inserting on save. */
    @Modifying
    @Query("DELETE FROM JiraPodRelease r WHERE r.pod.id = :podId")
    void deleteByPodId(@Param("podId") Long podId);
}
