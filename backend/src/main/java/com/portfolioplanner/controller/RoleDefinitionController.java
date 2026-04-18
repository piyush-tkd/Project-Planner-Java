package com.portfolioplanner.controller;

import com.portfolioplanner.service.RoleDefinitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class RoleDefinitionController {

    private final RoleDefinitionService roleDefinitionService;

    @GetMapping
    public List<RoleDefinitionService.RoleDto> list() {
        return roleDefinitionService.list();
    }

    @PostMapping
    public ResponseEntity<RoleDefinitionService.RoleDto> create(@RequestBody RoleDefinitionService.CreateRoleRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roleDefinitionService.create(req));
    }

    @PutMapping("/{name}")
    public RoleDefinitionService.RoleDto update(@PathVariable String name, @RequestBody RoleDefinitionService.UpdateRoleRequest req) {
        return roleDefinitionService.update(name, req);
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        roleDefinitionService.delete(name);
        return ResponseEntity.noContent().build();
    }
}
