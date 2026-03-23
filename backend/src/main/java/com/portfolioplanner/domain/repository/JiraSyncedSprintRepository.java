package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraSyncedSprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JiraSyncedSprintRepository extends JpaRepository<JiraSyncedSprint, Long> {

    Optional<JiraSyncedSprint> findBySprintJiraId(Long sprintJiraId);

    List<JiraSyncedSprint> findByProjectKey(String projectKey);

    List<JiraSyncedSprint> findByProjectKeyAndState(String projectKey, String state);

    List<JiraSyncedSprint> findByProjectKeyIn(List<String> projectKeys);

    List<JiraSyncedSprint> findByProjectKeyInAndState(List<String> projectKeys, String state);

    /** Closed sprints for given projects, ordered by end date desc, limited */
    @Query("SELECT s FROM JiraSyncedSprint s WHERE s.projectKey IN :keys " +
           "AND s.state = 'closed' ORDER BY s.endDate DESC")
    List<JiraSyncedSprint> findClosedByProjectKeys(@Param("keys") List<String> projectKeys);

    /** All sprints for given projects (for calendar-sprint overlap queries) */
    @Query("SELECT s FROM JiraSyncedSprint s WHERE s.projectKey IN :keys " +
           "AND s.startDate IS NOT NULL AND s.endDate IS NOT NULL " +
           "ORDER BY s.startDate DESC")
    List<JiraSyncedSprint> findWithDatesForProjectKeys(@Param("keys") List<String> projectKeys);

    /** Sprints by board ID */
    List<JiraSyncedSprint> findByBoardId(Long boardId);

    List<JiraSyncedSprint> findByBoardIdAndState(Long boardId, String state);
}
