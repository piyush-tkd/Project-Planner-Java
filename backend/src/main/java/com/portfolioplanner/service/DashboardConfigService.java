package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.DashboardConfig;
import com.portfolioplanner.domain.repository.DashboardConfigRepository;
import com.portfolioplanner.dto.DashboardConfigDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardConfigService {

    private final DashboardConfigRepository repo;

    // ── Queries ───────────────────────────────────────────────────────────────

    public List<DashboardConfigDto> listUserDashboards(String username) {
        return repo.findByOwnerUsernameOrderByUpdatedAtDesc(username)
                   .stream().map(DashboardConfigDto::from).collect(Collectors.toList());
    }

    public List<DashboardConfigDto> listTemplates() {
        return repo.findByIsTemplateTrue()
                   .stream().map(DashboardConfigDto::from).collect(Collectors.toList());
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public DashboardConfigDto createDashboard(DashboardConfigDto dto, String username) {
        DashboardConfig entity = new DashboardConfig();
        entity.setOwnerUsername(username);
        applyDto(entity, dto);
        return DashboardConfigDto.from(repo.save(entity));
    }

    @Transactional
    public DashboardConfigDto updateDashboard(Long id, DashboardConfigDto dto, String username) {
        DashboardConfig entity = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dashboard not found"));
        if (!entity.getOwnerUsername().equals(username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not the dashboard owner");
        }
        applyDto(entity, dto);
        return DashboardConfigDto.from(repo.save(entity));
    }

    @Transactional
    public void deleteDashboard(Long id, String username) {
        DashboardConfig entity = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dashboard not found"));
        if (!entity.getOwnerUsername().equals(username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not the dashboard owner");
        }
        repo.delete(entity);
    }

    @Transactional
    public DashboardConfigDto duplicateDashboard(Long id, String username) {
        DashboardConfig source = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dashboard not found"));
        DashboardConfig copy = new DashboardConfig();
        copy.setOwnerUsername(username);
        copy.setName(source.getName() + " (Copy)");
        copy.setDescription(source.getDescription());
        copy.setConfig(source.getConfig());
        copy.setThumbnailUrl(source.getThumbnailUrl());
        copy.setDefault(false);
        copy.setTemplate(false);
        return DashboardConfigDto.from(repo.save(copy));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void applyDto(DashboardConfig entity, DashboardConfigDto dto) {
        if (dto.getName() != null)         entity.setName(dto.getName());
        if (dto.getDescription() != null)  entity.setDescription(dto.getDescription());
        if (dto.getConfig() != null)       entity.setConfig(dto.getConfig());
        if (dto.getThumbnailUrl() != null) entity.setThumbnailUrl(dto.getThumbnailUrl());
        if (dto.getTemplateName() != null) entity.setTemplateName(dto.getTemplateName());
        entity.setDefault(dto.isDefault());
        entity.setTemplate(dto.isTemplate());
    }
}
