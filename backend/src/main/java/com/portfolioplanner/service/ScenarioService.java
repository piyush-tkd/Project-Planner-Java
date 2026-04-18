package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Scenario;
import com.portfolioplanner.domain.model.ScenarioChange;
import com.portfolioplanner.domain.model.ScenarioOverride;
import com.portfolioplanner.domain.model.ScenarioSnapshot;
import com.portfolioplanner.domain.repository.ScenarioChangeRepository;
import com.portfolioplanner.domain.repository.ScenarioOverrideRepository;
import com.portfolioplanner.domain.repository.ScenarioRepository;
import com.portfolioplanner.domain.repository.ScenarioSnapshotRepository;
import com.portfolioplanner.dto.request.ScenarioRequest;
import com.portfolioplanner.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScenarioService {

    private final ScenarioRepository scenarioRepository;
    private final ScenarioOverrideRepository overrideRepository;
    private final ScenarioChangeRepository changeRepository;
    private final ScenarioSnapshotRepository snapshotRepository;

    public List<Scenario> getAll() {
        return scenarioRepository.findAll();
    }

    public Scenario getById(Long id) {
        return scenarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", id));
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public Scenario create(ScenarioRequest request) {
        Scenario scenario = new Scenario();
        scenario.setName(request.name());
        scenario.setDescription(request.description());
        return scenarioRepository.save(scenario);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public Scenario update(Long id, ScenarioRequest request) {
        Scenario scenario = scenarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", id));
        scenario.setName(request.name());
        scenario.setDescription(request.description());
        return scenarioRepository.save(scenario);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void delete(Long id) {
        if (!scenarioRepository.existsById(id)) {
            throw new ResourceNotFoundException("Scenario", id);
        }
        overrideRepository.deleteAll(overrideRepository.findByScenarioId(id));
        scenarioRepository.deleteById(id);
    }

    public List<ScenarioOverride> getOverrides(Long scenarioId) {
        if (!scenarioRepository.existsById(scenarioId)) {
            throw new ResourceNotFoundException("Scenario", scenarioId);
        }
        return overrideRepository.findByScenarioId(scenarioId);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ScenarioOverride addOverride(Long scenarioId, ScenarioOverride override) {
        Scenario scenario = scenarioRepository.findById(scenarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Scenario", scenarioId));
        override.setScenario(scenario);
        return overrideRepository.save(override);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void deleteOverride(Long overrideId) {
        if (!overrideRepository.existsById(overrideId)) {
            throw new ResourceNotFoundException("ScenarioOverride", overrideId);
        }
        overrideRepository.deleteById(overrideId);
    }

    // ── Methods used by ScenarioPlanningController ────────────────────────────

    /** All scenarios, ordered by creation date descending. */
    public List<Scenario> findByOrderByCreatedAtDesc() {
        return scenarioRepository.findByOrderByCreatedAtDesc();
    }

    /** Lookup a scenario by id, returning empty if absent (controller maps to 404). */
    public Optional<Scenario> findById(Long id) {
        return scenarioRepository.findById(id);
    }

    /** Persist a new scenario entity directly (for callers that pre-populate fields). */
    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public Scenario save(Scenario scenario) {
        return scenarioRepository.save(scenario);
    }

    /**
     * Patch name / description / status from an inbound entity.
     * Returns empty if the scenario does not exist (controller maps to 404).
     */
    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public Optional<Scenario> updateFromEntity(Long id, Scenario updated) {
        return scenarioRepository.findById(id).map(existing -> {
            existing.setName(updated.getName());
            existing.setDescription(updated.getDescription());
            existing.setStatus(updated.getStatus());
            return scenarioRepository.save(existing);
        });
    }

    /**
     * Delete a scenario by id.
     *
     * @return {@code false} if the scenario did not exist (controller maps to 404)
     */
    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public boolean deleteScenario(Long id) {
        if (!scenarioRepository.existsById(id)) return false;
        scenarioRepository.deleteById(id);
        return true;
    }

    // ── Changes ───────────────────────────────────────────────────────────────

    public List<ScenarioChange> getChanges(Long scenarioId) {
        return changeRepository.findByScenarioId(scenarioId);
    }

    /**
     * Attach a change record to a scenario.
     * Returns empty if the scenario does not exist (controller maps to 404).
     */
    @Transactional
    public Optional<ScenarioChange> addChange(Long scenarioId, ScenarioChange change) {
        return scenarioRepository.findById(scenarioId).map(scenario -> {
            change.setScenario(scenario);
            return changeRepository.save(change);
        });
    }

    // ── Snapshots ─────────────────────────────────────────────────────────────

    public List<ScenarioSnapshot> getSnapshots(Long scenarioId) {
        return snapshotRepository.findByScenarioIdOrderBySnapshotDateAsc(scenarioId);
    }

    /**
     * Attach a snapshot to a scenario.
     * Returns empty if the scenario does not exist (controller maps to 404).
     */
    @Transactional
    public Optional<ScenarioSnapshot> addSnapshot(Long scenarioId, ScenarioSnapshot snapshot) {
        return scenarioRepository.findById(scenarioId).map(scenario -> {
            snapshot.setScenario(scenario);
            return snapshotRepository.save(snapshot);
        });
    }

    // ── Status transitions ────────────────────────────────────────────────────

    /**
     * Set a scenario's status to {@code ACTIVE}.
     * Returns empty if the scenario does not exist (controller maps to 404).
     */
    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public Optional<Scenario> activate(Long id) {
        return scenarioRepository.findById(id).map(s -> {
            s.setStatus("ACTIVE");
            return scenarioRepository.save(s);
        });
    }

    /**
     * Set a scenario's status to {@code APPROVED}.
     * Returns empty if the scenario does not exist (controller maps to 404).
     */
    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public Optional<Scenario> approve(Long id) {
        return scenarioRepository.findById(id).map(s -> {
            s.setStatus("APPROVED");
            return scenarioRepository.save(s);
        });
    }
}
