package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.JiraSupportSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface JiraSupportSnapshotRepository extends JpaRepository<JiraSupportSnapshot, Long> {

    Optional<JiraSupportSnapshot> findByBoardIdAndSnapshotDate(Long boardId, LocalDate date);

    @Query("""
        SELECT s FROM JiraSupportSnapshot s
        JOIN FETCH s.board b
        WHERE s.snapshotDate >= :from AND s.snapshotDate <= :to
        ORDER BY b.id, s.snapshotDate
    """)
    List<JiraSupportSnapshot> findByDateRange(
            @Param("from") LocalDate from,
            @Param("to")   LocalDate to);
}
