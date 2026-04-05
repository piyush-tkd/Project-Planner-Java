package com.portfolioplanner.controller;

import com.portfolioplanner.dto.NotificationScheduleDto;
import com.portfolioplanner.service.NotificationScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for managing notification scheduling configuration.
 *
 * GET  /api/settings/notification-schedule  — retrieve current config (ADMIN)
 * PUT  /api/settings/notification-schedule  — update config (ADMIN)
 */
@Slf4j
@RestController
@RequestMapping("/api/settings/notification-schedule")
@RequiredArgsConstructor
public class NotificationScheduleController {

    private final NotificationScheduleService notificationScheduleService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<NotificationScheduleDto> get() {
        return ResponseEntity.ok(notificationScheduleService.loadDto());
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<NotificationScheduleDto> save(@RequestBody NotificationScheduleDto dto) {
        return ResponseEntity.ok(notificationScheduleService.save(dto));
    }
}
