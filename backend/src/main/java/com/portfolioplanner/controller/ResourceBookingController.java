package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourceBooking;
import com.portfolioplanner.domain.repository.ResourceBookingRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/resource-bookings")
@RequiredArgsConstructor
public class ResourceBookingController {

    private final ResourceBookingRepository bookingRepo;
    private final ResourceRepository        resourceRepo;

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public record BookingResponse(
        Long   id,
        Long   resourceId,
        String resourceName,
        String resourceRole,
        String podName,
        Long   projectId,
        String projectLabel,
        String startDate,
        String endDate,
        int    allocationPct,
        String bookingType,
        String notes
    ) {}

    public record BookingRequest(
        @NotNull Long   resourceId,
        Long            projectId,
        String          projectLabel,
        @NotBlank String startDate,     // ISO yyyy-MM-dd
        @NotBlank String endDate,       // ISO yyyy-MM-dd
        @Min(1) @Max(100) Integer allocationPct,
        String          bookingType,
        String          notes
    ) {}

    // ── Mappings ─────────────────────────────────────────────────────────────

    private BookingResponse toDto(ResourceBooking b) {
        Resource r = b.getResource();
        return new BookingResponse(
            b.getId(),
            r.getId(),
            r.getName(),
            r.getRole() != null ? r.getRole().name() : null,
            null,  // podName: not stored directly on Resource; resolved client-side if needed
            b.getProjectId(),
            b.getProjectLabel(),
            b.getStartDate().toString(),
            b.getEndDate().toString(),
            b.getAllocationPct(),
            b.getBookingType(),
            b.getNotes()
        );
    }

    private void applyRequest(ResourceBooking entity, BookingRequest req) {
        Resource resource = resourceRepo.findById(req.resourceId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found"));
        entity.setResource(resource);
        entity.setProjectId(req.projectId());
        entity.setProjectLabel(req.projectLabel());
        entity.setStartDate(LocalDate.parse(req.startDate()));
        entity.setEndDate(LocalDate.parse(req.endDate()));
        entity.setAllocationPct(req.allocationPct() != null ? req.allocationPct() : 100);
        entity.setBookingType(req.bookingType() != null ? req.bookingType().toUpperCase() : "PROJECT");
        entity.setNotes(req.notes());

        if (entity.getEndDate().isBefore(entity.getStartDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be on or after start date");
        }
    }

    // ── Endpoints ────────────────────────────────────────────────────────────

    /** Get bookings in a date window; defaults to current 12-week window */
    @GetMapping
    public List<BookingResponse> getAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long resourceId) {

        LocalDate rangeStart = from != null ? from : LocalDate.now().minusWeeks(1);
        LocalDate rangeEnd   = to   != null ? to   : LocalDate.now().plusWeeks(12);

        if (resourceId != null)
            return bookingRepo.findByResourceIdInDateRange(resourceId, rangeStart, rangeEnd)
                              .stream().map(this::toDto).toList();
        return bookingRepo.findInDateRange(rangeStart, rangeEnd)
                          .stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public BookingResponse getById(@PathVariable Long id) {
        return bookingRepo.findById(id).map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingRequest req) {
        ResourceBooking entity = new ResourceBooking();
        applyRequest(entity, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(bookingRepo.save(entity)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public BookingResponse update(@PathVariable Long id, @Valid @RequestBody BookingRequest req) {
        ResourceBooking entity = bookingRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        applyRequest(entity, req);
        return toDto(bookingRepo.save(entity));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!bookingRepo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        bookingRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
