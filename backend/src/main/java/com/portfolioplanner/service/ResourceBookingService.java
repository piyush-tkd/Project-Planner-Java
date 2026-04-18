package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Resource;
import com.portfolioplanner.domain.model.ResourceBooking;
import com.portfolioplanner.domain.repository.ResourceBookingRepository;
import com.portfolioplanner.domain.repository.ResourceRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

/**
 * Business logic for resource booking management.
 *
 * <p>The controller {@code ResourceBookingController} delegates everything here — it is
 * responsible only for routing, @PreAuthorize checks, and HTTP status selection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResourceBookingService {

    private final ResourceBookingRepository bookingRepo;
    private final ResourceRepository        resourceRepo;

    // ── Public DTOs ───────────────────────────────────────────────────────────

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

    // ── Queries ───────────────────────────────────────────────────────────────

    /**
     * Returns bookings that overlap the given window.
     * Defaults to the current -1 week / +12 week window if {@code from}/{@code to} are null.
     * Optionally filters to a single resource.
     */
    @Transactional(readOnly = true)
    public List<BookingResponse> getAll(LocalDate from, LocalDate to, Long resourceId) {
        LocalDate rangeStart = from != null ? from : LocalDate.now().minusWeeks(1);
        LocalDate rangeEnd   = to   != null ? to   : LocalDate.now().plusWeeks(12);

        List<ResourceBooking> bookings = resourceId != null
            ? bookingRepo.findByResourceIdInDateRange(resourceId, rangeStart, rangeEnd)
            : bookingRepo.findInDateRange(rangeStart, rangeEnd);

        return bookings.stream().map(this::toDto).toList();
    }

    /** Fetch a single booking by id, throwing 404 if absent. */
    @Transactional(readOnly = true)
    public BookingResponse getById(Long id) {
        return bookingRepo.findById(id)
            .map(this::toDto)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /** Creates a new booking from the inbound request. */
    @Transactional
    public BookingResponse create(BookingRequest req) {
        ResourceBooking entity = new ResourceBooking();
        applyRequest(entity, req);
        BookingResponse saved = toDto(bookingRepo.save(entity));
        log.debug("ResourceBookingService: created booking id={} for resource {}", saved.id(), saved.resourceId());
        return saved;
    }

    /** Updates an existing booking, throwing 404 if absent. */
    @Transactional
    public BookingResponse update(Long id, BookingRequest req) {
        ResourceBooking entity = bookingRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        applyRequest(entity, req);
        return toDto(bookingRepo.save(entity));
    }

    /** Deletes a booking, throwing 404 if absent. */
    @Transactional
    public void delete(Long id) {
        if (!bookingRepo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        bookingRepo.deleteById(id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Applies a {@link BookingRequest} onto a {@link ResourceBooking} entity.
     * Resolves the resource FK, applies defaults, and validates the date range.
     */
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "End date must be on or after start date");
        }
    }

    private BookingResponse toDto(ResourceBooking b) {
        Resource r = b.getResource();
        return new BookingResponse(
            b.getId(),
            r.getId(),
            r.getName(),
            r.getRole() != null ? r.getRole().name() : null,
            null,   // podName: not stored on Resource; resolved client-side if needed
            b.getProjectId(),
            b.getProjectLabel(),
            b.getStartDate().toString(),
            b.getEndDate().toString(),
            b.getAllocationPct(),
            b.getBookingType(),
            b.getNotes()
        );
    }
}
