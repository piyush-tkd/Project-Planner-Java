package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.NlpConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NlpConversationRepository extends JpaRepository<NlpConversation, Long> {

    List<NlpConversation> findByUsernameOrderByUpdatedAtDesc(String username);

    Optional<NlpConversation> findByIdAndUsername(Long id, String username);
}
