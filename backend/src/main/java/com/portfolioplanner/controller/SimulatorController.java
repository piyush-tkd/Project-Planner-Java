package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.SimulationRequest;
import com.portfolioplanner.dto.response.CapacityGapResponse;
import jakarta.validation.Valid;
import com.portfolioplanner.dto.response.SimulationResultResponse;
import com.portfolioplanner.service.TimelineService;
import com.portfolioplanner.service.calculation.CalculationEngine;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot;
import com.portfolioplanner.service.calculation.dto.CalculationSnapshot.PodMonthGap;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/simulator")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SimulatorController {

    private final CalculationEngine calculationEngine;
    private final TimelineService timelineService;

    @PostMapping("/timeline")
    public ResponseEntity<SimulationResultResponse> runTimelineSimulation(
            @Valid @RequestBody SimulationRequest request) {

        CalculationSnapshot baseline = calculationEngine.compute();
        CalculationSnapshot simulated = calculationEngine.computeWithOverrides(request.projectOverrides());

        Map<Integer, String> monthLabels = timelineService.getMonthLabels();

        CapacityGapResponse baselineResponse = toCapacityGapResponse(baseline.gaps(), monthLabels);
        CapacityGapResponse simulatedResponse = toCapacityGapResponse(simulated.gaps(), monthLabels);
        CapacityGapResponse deltasResponse = computeDeltas(baseline.gaps(), simulated.gaps(), monthLabels);

        return ResponseEntity.ok(new SimulationResultResponse(baselineResponse, simulatedResponse, deltasResponse));
    }

    private CapacityGapResponse toCapacityGapResponse(List<PodMonthGap> gaps, Map<Integer, String> monthLabels) {
        List<CapacityGapResponse.PodMonthGap> responseGaps = gaps.stream()
                .map(g -> new CapacityGapResponse.PodMonthGap(
                        g.podId(),
                        g.podName(),
                        g.monthIndex(),
                        monthLabels.getOrDefault(g.monthIndex(), "M" + g.monthIndex()),
                        g.demandHours(),
                        g.capacityHours(),
                        g.gapHours(),
                        g.gapFte()
                ))
                .collect(Collectors.toList());
        return new CapacityGapResponse(responseGaps);
    }

    private CapacityGapResponse computeDeltas(
            List<PodMonthGap> baselineGaps,
            List<PodMonthGap> simulatedGaps,
            Map<Integer, String> monthLabels) {

        // Build lookup for simulated: podId + monthIndex -> gap
        Map<String, PodMonthGap> simLookup = simulatedGaps.stream()
                .collect(Collectors.toMap(
                        g -> g.podId() + "-" + g.monthIndex(),
                        g -> g,
                        (a, b) -> a
                ));

        List<CapacityGapResponse.PodMonthGap> deltas = new ArrayList<>();
        for (PodMonthGap bg : baselineGaps) {
            String key = bg.podId() + "-" + bg.monthIndex();
            PodMonthGap sg = simLookup.get(key);

            BigDecimal deltaDemand = (sg != null ? sg.demandHours() : BigDecimal.ZERO)
                    .subtract(bg.demandHours()).setScale(2, RoundingMode.HALF_UP);
            BigDecimal deltaCapacity = (sg != null ? sg.capacityHours() : BigDecimal.ZERO)
                    .subtract(bg.capacityHours()).setScale(2, RoundingMode.HALF_UP);
            BigDecimal deltaGap = (sg != null ? sg.gapHours() : BigDecimal.ZERO)
                    .subtract(bg.gapHours()).setScale(2, RoundingMode.HALF_UP);
            BigDecimal deltaFte = (sg != null ? sg.gapFte() : BigDecimal.ZERO)
                    .subtract(bg.gapFte()).setScale(2, RoundingMode.HALF_UP);

            deltas.add(new CapacityGapResponse.PodMonthGap(
                    bg.podId(),
                    bg.podName(),
                    bg.monthIndex(),
                    monthLabels.getOrDefault(bg.monthIndex(), "M" + bg.monthIndex()),
                    deltaDemand,
                    deltaCapacity,
                    deltaGap,
                    deltaFte
            ));
        }

        return new CapacityGapResponse(deltas);
    }
}
