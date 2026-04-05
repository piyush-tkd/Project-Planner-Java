package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.NotificationSchedule;
import com.portfolioplanner.domain.repository.NotificationScheduleRepository;
import com.portfolioplanner.dto.NotificationScheduleDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Manages the singleton {@link NotificationSchedule} row.
 *
 * <p>Both {@link WeeklyDigestService} and {@link SupportStalenessService} call
 * {@link #load()} at send-time so that the latest config is always used,
 * independent of when the cron fires.
 *
 * <p>{@link com.portfolioplanner.config.NotificationSchedulerConfig} calls
 * {@link #load()} to re-evaluate cron expressions on each scheduling cycle,
 * making schedule changes take effect without a restart.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationScheduleService {

    private final NotificationScheduleRepository repo;

    /** Returns the singleton entity, creating defaults if the row is missing. */
    @Transactional(readOnly = true)
    public NotificationSchedule load() {
        return repo.findById(1L).orElseGet(NotificationSchedule::new);
    }

    /** Returns the DTO representation. */
    @Transactional(readOnly = true)
    public NotificationScheduleDto loadDto() {
        NotificationSchedule cfg = load();
        NotificationScheduleDto dto = new NotificationScheduleDto();
        dto.setRecipients(cfg.getRecipients() != null ? cfg.getRecipients() : "");
        dto.setDigestEnabled(cfg.isDigestEnabled());
        dto.setDigestCron(cfg.getDigestCron());
        dto.setStalenessEnabled(cfg.isStalenessEnabled());
        dto.setStalenessCron(cfg.getStalenessCron());
        return dto;
    }

    /** Persists a new configuration. Blank/null cron expressions are ignored. */
    @Transactional
    public NotificationScheduleDto save(NotificationScheduleDto dto) {
        NotificationSchedule cfg = repo.findById(1L).orElseGet(NotificationSchedule::new);
        cfg.setId(1L);

        if (dto.getRecipients() != null) {
            cfg.setRecipients(dto.getRecipients().trim());
        }
        cfg.setDigestEnabled(dto.isDigestEnabled());
        if (dto.getDigestCron() != null && !dto.getDigestCron().isBlank()) {
            cfg.setDigestCron(dto.getDigestCron().trim());
        }
        cfg.setStalenessEnabled(dto.isStalenessEnabled());
        if (dto.getStalenessCron() != null && !dto.getStalenessCron().isBlank()) {
            cfg.setStalenessCron(dto.getStalenessCron().trim());
        }

        repo.save(cfg);
        log.info("NotificationScheduleService: config saved — digest={}, staleness={}",
                cfg.isDigestEnabled(), cfg.isStalenessEnabled());
        return loadDto();
    }

    /**
     * Returns the configured recipients as a list, filtering blank entries.
     * Convenience method used by digest and staleness services.
     */
    @Transactional(readOnly = true)
    public List<String> getRecipientList() {
        String raw = load().getRecipients();
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
