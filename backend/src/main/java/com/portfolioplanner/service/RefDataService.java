package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.EffortPattern;
import com.portfolioplanner.domain.model.RoleEffortMix;
import com.portfolioplanner.domain.model.TshirtSizeConfig;
import com.portfolioplanner.domain.model.enums.Role;
import com.portfolioplanner.domain.repository.EffortPatternRepository;
import com.portfolioplanner.domain.repository.RoleEffortMixRepository;
import com.portfolioplanner.domain.repository.TshirtSizeConfigRepository;
import com.portfolioplanner.dto.request.EffortPatternRequest;
import com.portfolioplanner.dto.request.RoleEffortMixRequest;
import com.portfolioplanner.dto.request.TshirtSizeRequest;
import com.portfolioplanner.dto.response.EffortPatternResponse;
import com.portfolioplanner.dto.response.RoleEffortMixResponse;
import com.portfolioplanner.dto.response.TshirtSizeResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RefDataService {

    private final EffortPatternRepository effortPatternRepository;
    private final RoleEffortMixRepository roleEffortMixRepository;
    private final TshirtSizeConfigRepository tshirtSizeConfigRepository;
    private final EntityMapper mapper;

    public List<TshirtSizeResponse> getTshirtSizes() {
        return mapper.toTshirtSizeResponseList(tshirtSizeConfigRepository.findAllByOrderByDisplayOrderAsc());
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public TshirtSizeResponse createTshirtSize(TshirtSizeRequest request) {
        if (tshirtSizeConfigRepository.existsByName(request.name())) {
            throw new IllegalArgumentException("T-shirt size '" + request.name() + "' already exists");
        }
        TshirtSizeConfig config = new TshirtSizeConfig();
        config.setName(request.name());
        config.setBaseHours(request.baseHours());
        config.setDisplayOrder(request.displayOrder());
        config = tshirtSizeConfigRepository.save(config);
        return mapper.toTshirtSizeResponse(config);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public TshirtSizeResponse updateTshirtSize(Long id, TshirtSizeRequest request) {
        TshirtSizeConfig config = tshirtSizeConfigRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TshirtSizeConfig", id));
        config.setName(request.name());
        config.setBaseHours(request.baseHours());
        config.setDisplayOrder(request.displayOrder());
        config = tshirtSizeConfigRepository.save(config);
        return mapper.toTshirtSizeResponse(config);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void deleteTshirtSize(Long id) {
        if (!tshirtSizeConfigRepository.existsById(id)) {
            throw new ResourceNotFoundException("TshirtSizeConfig", id);
        }
        tshirtSizeConfigRepository.deleteById(id);
    }

    public List<EffortPatternResponse> getEffortPatterns() {
        return mapper.toEffortPatternResponseList(effortPatternRepository.findAll());
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public EffortPatternResponse createEffortPattern(EffortPatternRequest request) {
        EffortPattern pattern = new EffortPattern();
        pattern.setName(request.name());
        pattern.setDescription(request.description());
        pattern.setWeights(request.weights());
        pattern = effortPatternRepository.save(pattern);
        return mapper.toEffortPatternResponse(pattern);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public EffortPatternResponse updateEffortPattern(Long id, EffortPatternRequest request) {
        EffortPattern pattern = effortPatternRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EffortPattern", id));
        pattern.setName(request.name());
        pattern.setDescription(request.description());
        pattern.setWeights(request.weights());
        pattern = effortPatternRepository.save(pattern);
        return mapper.toEffortPatternResponse(pattern);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void deleteEffortPattern(Long id) {
        if (!effortPatternRepository.existsById(id)) {
            throw new ResourceNotFoundException("EffortPattern", id);
        }
        effortPatternRepository.deleteById(id);
    }

    public List<RoleEffortMixResponse> getRoleMix() {
        return mapper.toRoleEffortMixResponseList(roleEffortMixRepository.findAll());
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public RoleEffortMixResponse createOrUpdateRoleMix(RoleEffortMixRequest request) {
        Role role = Role.valueOf(request.role());
        RoleEffortMix mix = roleEffortMixRepository.findByRole(role)
                .orElseGet(() -> {
                    RoleEffortMix m = new RoleEffortMix();
                    m.setRole(role);
                    return m;
                });
        mix.setMixPct(request.mixPct());
        mix = roleEffortMixRepository.save(mix);
        return mapper.toRoleEffortMixResponse(mix);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void deleteRoleMix(String roleName) {
        Role role = Role.valueOf(roleName);
        RoleEffortMix mix = roleEffortMixRepository.findByRole(role)
                .orElseThrow(() -> new ResourceNotFoundException("RoleEffortMix", 0L));
        roleEffortMixRepository.delete(mix);
    }
}
