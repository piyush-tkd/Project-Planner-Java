package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraReleaseMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraReleaseMappingRepository extends JpaRepository<JiraReleaseMapping, Long> {

    List<JiraReleaseMapping> findByReleaseCalendarId(Long releaseCalendarId);

    List<JiraReleaseMapping> findAllByOrderByReleaseCalendarIdAsc();

    void deleteByReleaseCalendarId(Long releaseCalendarId);

    Optional<JiraReleaseMapping> findByReleaseCalendarIdAndJiraVersionNameAndJiraProjectKey(
        Long releaseCalendarId, String jiraVersionName, String jiraProjectKey);
}
