package com.portfolioplanner.controller;

import com.portfolioplanner.dto.request.EffortPatternRequest;
import com.portfolioplanner.dto.request.RoleEffortMixRequest;
import com.portfolioplanner.dto.request.TshirtSizeRequest;
import com.portfolioplanner.dto.response.EffortPatternResponse;
import com.portfolioplanner.dto.response.RoleEffortMixResponse;
import com.portfolioplanner.dto.response.TshirtSizeResponse;
import com.portfolioplanner.service.RefDataService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/ref-data")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class RefDataController {

    private final RefDataService refDataService;

    @GetMapping("/tshirt-sizes")
    public ResponseEntity<List<TshirtSizeResponse>> getTshirtSizes() {
        return ResponseEntity.ok(refDataService.getTshirtSizes());
    }

    @PostMapping("/tshirt-sizes")
    public ResponseEntity<TshirtSizeResponse> createTshirtSize(@Valid @RequestBody TshirtSizeRequest request) {
        return ResponseEntity.ok(refDataService.createTshirtSize(request));
    }

    @PutMapping("/tshirt-sizes/{id}")
    public ResponseEntity<TshirtSizeResponse> updateTshirtSize(@PathVariable Long id, @Valid @RequestBody TshirtSizeRequest request) {
        return ResponseEntity.ok(refDataService.updateTshirtSize(id, request));
    }

    @DeleteMapping("/tshirt-sizes/{id}")
    public ResponseEntity<Void> deleteTshirtSize(@PathVariable Long id) {
        refDataService.deleteTshirtSize(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/effort-patterns")
    public ResponseEntity<List<EffortPatternResponse>> getEffortPatterns() {
        return ResponseEntity.ok(refDataService.getEffortPatterns());
    }

    @PostMapping("/effort-patterns")
    public ResponseEntity<EffortPatternResponse> createEffortPattern(@Valid @RequestBody EffortPatternRequest request) {
        return ResponseEntity.ok(refDataService.createEffortPattern(request));
    }

    @PutMapping("/effort-patterns/{id}")
    public ResponseEntity<EffortPatternResponse> updateEffortPattern(@PathVariable Long id, @Valid @RequestBody EffortPatternRequest request) {
        return ResponseEntity.ok(refDataService.updateEffortPattern(id, request));
    }

    @DeleteMapping("/effort-patterns/{id}")
    public ResponseEntity<Void> deleteEffortPattern(@PathVariable Long id) {
        refDataService.deleteEffortPattern(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/role-mix")
    public ResponseEntity<List<RoleEffortMixResponse>> getRoleMix() {
        return ResponseEntity.ok(refDataService.getRoleMix());
    }

    @PostMapping("/role-mix")
    public ResponseEntity<RoleEffortMixResponse> createOrUpdateRoleMix(@Valid @RequestBody RoleEffortMixRequest request) {
        return ResponseEntity.ok(refDataService.createOrUpdateRoleMix(request));
    }

    @DeleteMapping("/role-mix/{role}")
    public ResponseEntity<Void> deleteRoleMix(@PathVariable String role) {
        refDataService.deleteRoleMix(role);
        return ResponseEntity.noContent().build();
    }
}
