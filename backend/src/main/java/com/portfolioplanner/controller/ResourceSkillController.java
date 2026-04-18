package com.portfolioplanner.controller;

import com.portfolioplanner.service.ResourceSkillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceSkillController {

    private final ResourceSkillService resourceSkillService;

    // ── Endpoints ────────────────────────────────────────────────────────────

    @GetMapping("/{resourceId}/skills")
    public List<ResourceSkillService.SkillResponse> getSkills(@PathVariable Long resourceId) {
        return resourceSkillService.getSkills(resourceId);
    }

    @PostMapping("/{resourceId}/skills")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<ResourceSkillService.SkillResponse> addSkill(@PathVariable Long resourceId,
                                                   @RequestBody ResourceSkillService.SkillRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(resourceSkillService.addSkill(resourceId, req));
    }

    @DeleteMapping("/{resourceId}/skills/{skillName}")
    @PreAuthorize("hasAnyRole('ADMIN','READ_WRITE')")
    public ResponseEntity<Void> removeSkill(@PathVariable Long resourceId,
                                             @PathVariable String skillName) {
        resourceSkillService.removeSkill(resourceId, skillName);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/skills/matrix")
    public List<ResourceSkillService.SkillMatrixRow> getMatrix() {
        return resourceSkillService.getMatrix();
    }

    @GetMapping("/skills/summary")
    public List<ResourceSkillService.SkillSummary> getSummary() {
        return resourceSkillService.getSummary();
    }
}
