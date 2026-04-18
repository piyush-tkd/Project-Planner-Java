package com.portfolioplanner.controller;

import com.portfolioplanner.service.ResourceBookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Thin routing layer for resource bookings.
 * All business logic lives in {@link ResourceBookingService}.
 */
@RestController
@RequestMapping("/api/resource-bookings")
@RequiredArgsConstructor
public class ResourceBookingController {

    private final ResourceBookingService bookingService;

    @GetMapping
    public List<ResourceBookingService.BookingResponse> getAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long resourceId) {
        return bookingService.getAll(from, to, resourceId);
    }

    @GetMapping("/{id}")
    public ResourceBookingService.BookingResponse getById(@PathVariable Long id) {
        return bookingService.getById(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ResourceBookingService.BookingResponse> create(
            @Valid @RequestBody ResourceBookingService.BookingRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(bookingService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResourceBookingService.BookingResponse update(
            @PathVariable Long id,
            @Valid @RequestBody ResourceBookingService.BookingRequest req) {
        return bookingService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        bookingService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
