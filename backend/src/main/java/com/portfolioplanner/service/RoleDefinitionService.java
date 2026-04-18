package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.RoleDefinition;
import com.portfolioplanner.domain.repository.RoleDefinitionRepository;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.exception.ValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RoleDefinitionService {

    private final RoleDefinitionRepository roleDefinitionRepository;

    public record RoleDto(Long id, String name, String displayName, String description, boolean system, String color, String createdAt) {
        static RoleDto from(RoleDefinition r) {
            return new RoleDto(r.getId(), r.getName(), r.getDisplayName(), r.getDescription(), r.isSystem(), r.getColor(), r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
        }
    }

    public record CreateRoleRequest(String name, String displayName, String description, String color) {}
    public record UpdateRoleRequest(String displayName, String description, String color) {}

    public List<RoleDto> list() {
        return roleDefinitionRepository.findAllByOrderBySystemDescNameAsc().stream().map(RoleDto::from).toList();
    }

    @Transactional
    public RoleDto create(CreateRoleRequest request) {
        String normalized = request.name().toUpperCase().replaceAll("[^A-Z0-9_]", "_");
        if (roleDefinitionRepository.existsByName(normalized)) {
            throw new ValidationException("Role already exists: " + normalized);
        }
        RoleDefinition r = new RoleDefinition();
        r.setName(normalized);
        r.setDisplayName(request.displayName());
        r.setDescription(request.description());
        r.setSystem(false);
        r.setColor(request.color() != null ? request.color() : "blue");
        r.setCreatedAt(LocalDateTime.now());
        return RoleDto.from(roleDefinitionRepository.save(r));
    }

    @Transactional
    public RoleDto update(String name, UpdateRoleRequest request) {
        RoleDefinition r = roleDefinitionRepository.findByName(name.toUpperCase())
            .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + name));
        if (request.displayName() != null) r.setDisplayName(request.displayName());
        if (request.description() != null) r.setDescription(request.description());
        if (request.color() != null) r.setColor(request.color());
        return RoleDto.from(roleDefinitionRepository.save(r));
    }

    @Transactional
    public void delete(String name) {
        RoleDefinition r = roleDefinitionRepository.findByName(name.toUpperCase())
            .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + name));
        if (r.isSystem()) {
            throw new ValidationException("System roles cannot be deleted: " + name);
        }
        roleDefinitionRepository.delete(r);
    }
}
