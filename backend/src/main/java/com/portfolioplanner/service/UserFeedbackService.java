package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.UserFeedback;
import com.portfolioplanner.domain.repository.UserFeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserFeedbackService {

    private final UserFeedbackRepository userFeedbackRepository;

    @Transactional
    public UserFeedback submit(Map<String, Object> body, String submittedBy) {
        UserFeedback fb = new UserFeedback();
        fb.setCategory(body.getOrDefault("category", "OTHER").toString());
        fb.setMessage(body.get("message").toString());
        fb.setPageUrl(body.get("pageUrl") != null ? body.get("pageUrl").toString() : null);
        fb.setScreenshot(body.get("screenshot") != null ? body.get("screenshot").toString() : null);
        fb.setSubmittedBy(submittedBy != null ? submittedBy : "anonymous");
        fb.setPriority(body.getOrDefault("priority", "MEDIUM").toString());
        if (body.get("rating") != null) {
            fb.setRating(Short.parseShort(body.get("rating").toString()));
        }
        return userFeedbackRepository.save(fb);
    }

    public List<UserFeedback> getAll() {
        return userFeedbackRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public Optional<UserFeedback> update(Long id, Map<String, Object> body) {
        return userFeedbackRepository.findById(id).map(fb -> {
            if (body.containsKey("status"))     fb.setStatus(body.get("status").toString());
            if (body.containsKey("priority"))   fb.setPriority(body.get("priority").toString());
            if (body.containsKey("adminNotes")) fb.setAdminNotes(body.get("adminNotes").toString());
            return userFeedbackRepository.save(fb);
        });
    }

    @Transactional
    public void delete(Long id) {
        userFeedbackRepository.deleteById(id);
    }
}
