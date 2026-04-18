package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.CostRate;
import com.portfolioplanner.domain.model.enums.Location;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.repository.CostRateRepository;
import com.portfolioplanner.dto.response.CostRateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CostRateService {

    private final CostRateRepository repo;

    public List<CostRateResponse> getAll() {
        return repo.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public CostRateResponse create(Role role, Location location, BigDecimal hourlyRate) {
        repo.findByRoleAndLocation(role, location).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Rate already exists for " + role + " / " + location);
        });
        CostRate rate = new CostRate(null, role, location, hourlyRate);
        return toDto(repo.save(rate));
    }

    @Transactional
    public CostRateResponse update(Long id, Role role, Location location, BigDecimal hourlyRate) {
        CostRate rate = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cost rate not found"));
        rate.setRole(role);
        rate.setLocation(location);
        rate.setHourlyRate(hourlyRate);
        return toDto(repo.save(rate));
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cost rate not found");
        repo.deleteById(id);
    }

    private CostRateResponse toDto(CostRate r) {
        return new CostRateResponse(r.getId(), r.getRole(), r.getLocation(), r.getHourlyRate());
    }
}
