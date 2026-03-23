package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.UserFeedback;
import com.portfolioplanner.domain.repository.UserFeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class UserFeedbackController {

    private final UserFeedbackRepository feedbackRepo;

    /** Submit new feedback (any authenticated user). */
    @PostMapping
    public ResponseEntity<UserFeedback> submit(@RequestBody Map<String, Object> body,
                                                Authentication auth) {
        UserFeedback fb = new UserFeedback();
        fb.setCategory(body.getOrDefault("category", "OTHER").toString());
        fb.setMessage(body.get("message").toString());
        fb.setPageUrl(body.get("pageUrl") != null ? body.get("pageUrl").toString() : null);
        fb.setScreenshot(body.get("screenshot") != null ? body.get("screenshot").toString() : null);
        fb.setSubmittedBy(auth != null ? auth.getName() : "anonymous");
        fb.setPriority(body.getOrDefault("priority", "MEDIUM").toString());
        if (body.get("rating") != null) {
            fb.setRating(Short.parseShort(body.get("rating").toString()));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(feedbackRepo.save(fb));
    }

    /** List all feedback (for admin Feedback Hub). */
    @GetMapping
    public ResponseEntity<List<UserFeedback>> getAll() {
        return ResponseEntity.ok(feedbackRepo.findAllByOrderByCreatedAtDesc());
    }

    /** Update feedback status / admin notes / priority. */
    @PutMapping("/{id}")
    public ResponseEntity<UserFeedback> update(@PathVariable Long id,
                                                @RequestBody Map<String, Object> body) {
        UserFeedback fb = feedbackRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Feedback not found: " + id));
        if (body.containsKey("status"))     fb.setStatus(body.get("status").toString());
        if (body.containsKey("priority"))   fb.setPriority(body.get("priority").toString());
        if (body.containsKey("adminNotes")) fb.setAdminNotes(body.get("adminNotes").toString());
        return ResponseEntity.ok(feedbackRepo.save(fb));
    }

    /** Delete feedback. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        feedbackRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
