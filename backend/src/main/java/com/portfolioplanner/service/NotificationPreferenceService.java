package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.NotificationPreference;
import com.portfolioplanner.domain.repository.NotificationPreferenceRepository;
import com.portfolioplanner.dto.NotificationPreferenceDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationPreferenceService {

    private final NotificationPreferenceRepository repo;

    @Transactional
    public NotificationPreferenceDto get(String username) {
        NotificationPreference pref = repo.findByUsername(username)
                .orElseGet(() -> createDefaults(username));
        return toDto(pref);
    }

    @Transactional
    public NotificationPreferenceDto upsert(String username, NotificationPreferenceDto dto) {
        NotificationPreference pref = repo.findByUsername(username)
                .orElseGet(() -> {
                    NotificationPreference p = new NotificationPreference();
                    p.setUsername(username);
                    return p;
                });

        applyDto(pref, dto);
        return toDto(repo.save(pref));
    }

    private NotificationPreference createDefaults(String username) {
        NotificationPreference p = new NotificationPreference();
        p.setUsername(username);
        return repo.save(p);
    }

    private void applyDto(NotificationPreference p, NotificationPreferenceDto dto) {
        p.setOnStatusChange(dto.isOnStatusChange());
        p.setOnRiskAdded(dto.isOnRiskAdded());
        p.setOnCommentMention(dto.isOnCommentMention());
        p.setOnSprintStart(dto.isOnSprintStart());
        p.setOnAutomationFired(dto.isOnAutomationFired());
        p.setOnTargetDatePassed(dto.isOnTargetDatePassed());
        p.setOnApprovalPending(dto.isOnApprovalPending());
        p.setOnApprovalDecision(dto.isOnApprovalDecision());
        p.setEmailEnabled(dto.isEmailEnabled());
        p.setEmailDigest(dto.getEmailDigest() != null ? dto.getEmailDigest() : "NONE");
        p.setQuietStartHour(dto.getQuietStartHour());
        p.setQuietEndHour(dto.getQuietEndHour());
    }

    private NotificationPreferenceDto toDto(NotificationPreference p) {
        return new NotificationPreferenceDto(
                p.getId(),
                p.getUsername(),
                p.isOnStatusChange(),
                p.isOnRiskAdded(),
                p.isOnCommentMention(),
                p.isOnSprintStart(),
                p.isOnAutomationFired(),
                p.isOnTargetDatePassed(),
                p.isOnApprovalPending(),
                p.isOnApprovalDecision(),
                p.isEmailEnabled(),
                p.getEmailDigest(),
                p.getQuietStartHour(),
                p.getQuietEndHour()
        );
    }
}
