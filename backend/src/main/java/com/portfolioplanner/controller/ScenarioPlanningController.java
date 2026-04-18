package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.Scenario;
import com.portfolioplanner.domain.model.ScenarioChange;
import com.portfolioplanner.domain.model.ScenarioSnapshot;
import com.portfolioplanner.service.ScenarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Thin routing layer for scenario planning.
 * All business logic lives in {@link ScenarioService}.
 */
@RestController
@RequestMapping("/api/scenarios")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
public class ScenarioPlanningController {

    private final ScenarioService scenarioService;

    @GetMapping
    public List<Scenario> getScenarios() {
        return scenarioService.findByOrderByCreatedAtDesc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Scenario> getScenario(@PathVariable Long id) {
        return scenarioService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Scenario createScenario(@RequestBody Scenario scenario) {
        return scenarioService.save(scenario);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Scenario> updateScenario(@PathVariable Long id, @RequestBody Scenario updated) {
        return scenarioService.updateFromEntity(id, updated)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScenario(@PathVariable Long id) {
        return scenarioService.deleteScenario(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}/changes")
    public List<ScenarioChange> getChanges(@PathVariable Long id) {
        return scenarioService.getChanges(id);
    }

    @PostMapping("/{id}/changes")
    public ResponseEntity<ScenarioChange> addChange(@PathVariable Long id, @RequestBody ScenarioChange change) {
        return scenarioService.addChange(id, change)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/snapshots")
    public List<ScenarioSnapshot> getSnapshots(@PathVariable Long id) {
        return scenarioService.getSnapshots(id);
    }

    @PostMapping("/{id}/snapshots")
    public ResponseEntity<ScenarioSnapshot> addSnapshot(@PathVariable Long id, @RequestBody ScenarioSnapshot snapshot) {
        return scenarioService.addSnapshot(id, snapshot)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/activate")
    public ResponseEntity<Scenario> activateScenario(@PathVariable Long id) {
        return scenarioService.activate(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{id}/approve")
    public ResponseEntity<Scenario> approveScenario(@PathVariable Long id) {
        return scenarioService.approve(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
