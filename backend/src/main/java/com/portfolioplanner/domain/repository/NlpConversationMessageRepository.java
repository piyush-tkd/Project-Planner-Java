package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NlpConversationMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NlpConversationMessageRepository extends JpaRepository<NlpConversationMessage, Long> {

    List<NlpConversationMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    long countByConversationId(Long conversationId);
}
