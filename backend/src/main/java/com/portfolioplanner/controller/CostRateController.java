package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.CostRate;
import com.portfolioplanner.domain.repository.CostRateRepository;
import com.portfolioplanner.dto.response.CostRateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cost-rates")
@RequiredArgsConstructor
public class CostRateController {

    private final CostRateRepository costRateRepository;

    @GetMapping
    public List<CostRateResponse> getAll() {
        return costRateRepository.findAll().stream()
                .map(r -> new CostRateResponse(r.getId(), r.getRole(), r.getLocation(), r.getHourlyRate()))
                .toList();
    }
}
