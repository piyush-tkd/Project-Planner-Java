package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.ReleaseCalendar;
import com.portfolioplanner.domain.repository.ReleaseCalendarRepository;
import com.portfolioplanner.dto.request.ReleaseCalendarRequest;
import com.portfolioplanner.dto.response.ReleaseCalendarResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReleaseCalendarService {

    private final ReleaseCalendarRepository releaseCalendarRepository;
    private final EntityMapper mapper;

    public List<ReleaseCalendarResponse> getAll() {
        return mapper.toReleaseCalendarResponseList(
                releaseCalendarRepository.findAllByOrderByReleaseDateAsc());
    }

    @Transactional
    public ReleaseCalendarResponse create(ReleaseCalendarRequest request) {
        ReleaseCalendar release = new ReleaseCalendar();
        applyRequest(release, request);
        return mapper.toReleaseCalendarResponse(releaseCalendarRepository.save(release));
    }

    @Transactional
    public ReleaseCalendarResponse update(Long id, ReleaseCalendarRequest request) {
        ReleaseCalendar release = releaseCalendarRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Release", id));
        applyRequest(release, request);
        return mapper.toReleaseCalendarResponse(releaseCalendarRepository.save(release));
    }

    @Transactional
    public void delete(Long id) {
        if (!releaseCalendarRepository.existsById(id)) throw new ResourceNotFoundException("Release", id);
        releaseCalendarRepository.deleteById(id);
    }

    private void applyRequest(ReleaseCalendar release, ReleaseCalendarRequest req) {
        release.setName(req.name());
        release.setReleaseDate(req.releaseDate());
        release.setCodeFreezeDate(req.codeFreezeDate());
        release.setType(req.type() != null ? req.type() : "REGULAR");
        release.setNotes(req.notes());
    }
}
