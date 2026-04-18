package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.UserFeedback;
import com.portfolioplanner.service.UserFeedbackService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class UserFeedbackController {

    private final UserFeedbackService userFeedbackService;

    @PostMapping
    public ResponseEntity<UserFeedback> submit(@RequestBody Map<String, Object> body,
                                                Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            userFeedbackService.submit(body, auth != null ? auth.getName() : "anonymous"));
    }

    @GetMapping
    public ResponseEntity<List<UserFeedback>> getAll() {
        return ResponseEntity.ok(userFeedbackService.getAll());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<UserFeedback> update(@PathVariable Long id,
                                                @RequestBody Map<String, Object> body) {
        return userFeedbackService.update(id, body)
            .map(ResponseEntity::ok)
            .orElseThrow(() -> new RuntimeException("Feedback not found: " + id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        userFeedbackService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
