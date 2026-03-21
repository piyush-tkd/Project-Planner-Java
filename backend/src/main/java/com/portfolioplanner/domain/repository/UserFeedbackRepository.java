package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.UserFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, Long> {

    List<UserFeedback> findAllByOrderByCreatedAtDesc();

    List<UserFeedback> findByStatusOrderByCreatedAtDesc(String status);

    List<UserFeedback> findBySubmittedByOrderByCreatedAtDesc(String submittedBy);

    List<UserFeedback> findByCategoryOrderByCreatedAtDesc(String category);
}
