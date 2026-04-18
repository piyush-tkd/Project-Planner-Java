package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraReleaseMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraReleaseMappingRepository extends JpaRepository<JiraReleaseMapping, Long> {

    List<JiraReleaseMapping> findByReleaseCalendarId(Long releaseCalendarId);

    /**
     * Fetch all mappings with their ReleaseCalendar parent in one query.
     * releaseCalendar is now LAZY; this JOIN FETCH prevents N+1 in the
     * groupingBy(m -> m.getReleaseCalendar().getId()) call in JiraReleaseMappingService.
     */
    @Query("SELECT m FROM JiraReleaseMapping m LEFT JOIN FETCH m.releaseCalendar " +
           "ORDER BY m.releaseCalendar.id ASC")
    List<JiraReleaseMapping> findAllByOrderByReleaseCalendarIdAsc();

    void deleteByReleaseCalendarId(Long releaseCalendarId);

    Optional<JiraReleaseMapping> findByReleaseCalendarIdAndJiraVersionNameAndJiraProjectKey(
        Long releaseCalendarId, String jiraVersionName, String jiraProjectKey);
}
