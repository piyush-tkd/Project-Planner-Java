package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.Scenario;
import com.portfolioplanner.domain.model.ScenarioOverride;
import com.portfolioplanner.domain.repository.ScenarioOverrideRepository;
import com.portfolioplanner.domain.repository.ScenarioRepository;
import com.portfolioplanner.dto.request.ScenarioRequest;
import com.portfolioplanner.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScenarioService {

    private final ScenarioRepository scenarioRepository;
    private final ScenarioOverrideRepository overrideRepository;

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
}
