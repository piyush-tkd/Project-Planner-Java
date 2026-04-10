package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.*;
import com.portfolioplanner.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/scenarios")
@RequiredArgsConstructor
public class ScenarioPlanningController {
    private final ScenarioRepository scenarioRepository;
    private final ScenarioChangeRepository changeRepository;
    private final ScenarioSnapshotRepository snapshotRepository;

    @GetMapping
    public List<Scenario> getScenarios() {
        return scenarioRepository.findByOrderByCreatedAtDesc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Scenario> getScenario(@PathVariable Long id) {
        return scenarioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Scenario createScenario(@RequestBody Scenario scenario) {
        return scenarioRepository.save(scenario);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Scenario> updateScenario(@PathVariable Long id, @RequestBody Scenario updated) {
        return scenarioRepository.findById(id).map(existing -> {
            existing.setName(updated.getName());
            existing.setDescription(updated.getDescription());
            existing.setStatus(updated.getStatus());
            return ResponseEntity.ok(scenarioRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScenario(@PathVariable Long id) {
        if (!scenarioRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        scenarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/changes")
    public List<ScenarioChange> getChanges(@PathVariable Long id) {
        return changeRepository.findByScenarioId(id);
    }

    @PostMapping("/{id}/changes")
    public ResponseEntity<ScenarioChange> addChange(@PathVariable Long id, @RequestBody ScenarioChange change) {
        return scenarioRepository.findById(id).map(scenario -> {
            change.setScenario(scenario);
            return ResponseEntity.ok(changeRepository.save(change));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/snapshots")
    public List<ScenarioSnapshot> getSnapshots(@PathVariable Long id) {
        return snapshotRepository.findByScenarioIdOrderBySnapshotDateAsc(id);
    }

    @PostMapping("/{id}/snapshots")
    public ResponseEntity<ScenarioSnapshot> addSnapshot(@PathVariable Long id, @RequestBody ScenarioSnapshot snapshot) {
        return scenarioRepository.findById(id).map(scenario -> {
            snapshot.setScenario(scenario);
            return ResponseEntity.ok(snapshotRepository.save(snapshot));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<Scenario> activateScenario(@PathVariable Long id) {
        return scenarioRepository.findById(id).map(s -> {
            s.setStatus("ACTIVE");
            return ResponseEntity.ok(scenarioRepository.save(s));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Scenario> approveScenario(@PathVariable Long id) {
        return scenarioRepository.findById(id).map(s -> {
            s.setStatus("APPROVED");
            return ResponseEntity.ok(scenarioRepository.save(s));
        }).orElse(ResponseEntity.notFound().build());
    }
}
