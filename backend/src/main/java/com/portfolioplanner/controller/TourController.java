package com.portfolioplanner.controller;

import com.portfolioplanner.domain.model.TourConfig;
import com.portfolioplanner.domain.model.UserTourState;
import com.portfolioplanner.domain.repository.TourConfigRepository;
import com.portfolioplanner.domain.repository.UserTourStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/tour")
@RequiredArgsConstructor
public class TourController {

    private final TourConfigRepository tourConfigRepository;
    private final UserTourStateRepository userTourStateRepository;

    /** Returns the tour config + whether the current user should see the tour */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(
            @AuthenticationPrincipal UserDetails principal) {

        TourConfig config = tourConfigRepository.findAll().stream().findFirst()
                .orElseGet(() -> {
                    TourConfig c = new TourConfig();
                    return tourConfigRepository.save(c);
                });

        if (!config.getEnabled() || "disabled".equals(config.getFrequency())) {
            return ResponseEntity.ok(Map.of("showTour", false, "config", toMap(config)));
        }

        String username = principal.getUsername();
        UserTourState state = userTourStateRepository.findByUsername(username)
                .orElse(null);

        boolean show = switch (config.getFrequency()) {
            case "every_login" -> true;
            case "first_login" -> state == null || state.getSeenCount() == 0;
            case "every_n" -> {
                if (state == null || state.getLastSeenAt() == null) yield true;
                long daysSince = java.time.temporal.ChronoUnit.DAYS
                        .between(state.getLastSeenAt(), LocalDateTime.now());
                yield daysSince >= config.getEveryN();
            }
            default -> false;
        };

        return ResponseEntity.ok(Map.of("showTour", show, "config", toMap(config)));
    }

    /** Mark the tour as seen for the current user */
    @PostMapping("/seen")
    public ResponseEntity<Void> markSeen(
            @AuthenticationPrincipal UserDetails principal) {

        String username = principal.getUsername();
        UserTourState state = userTourStateRepository.findByUsername(username)
                .orElseGet(() -> {
                    UserTourState s = new UserTourState();
                    s.setUsername(username);
                    return s;
                });
        state.setSeenCount(state.getSeenCount() + 1);
        state.setLastSeenAt(LocalDateTime.now());
        userTourStateRepository.save(state);
        return ResponseEntity.ok().build();
    }

    /** Admin: get current tour config */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        TourConfig config = tourConfigRepository.findAll().stream().findFirst()
                .orElseGet(() -> tourConfigRepository.save(new TourConfig()));
        return ResponseEntity.ok(toMap(config));
    }

    /** Admin: update tour config */
    @PutMapping("/config")
    public ResponseEntity<Map<String, Object>> updateConfig(
            @RequestBody Map<String, Object> body) {

        TourConfig config = tourConfigRepository.findAll().stream().findFirst()
                .orElseGet(() -> tourConfigRepository.save(new TourConfig()));

        if (body.containsKey("enabled"))
            config.setEnabled(Boolean.parseBoolean(body.get("enabled").toString()));
        if (body.containsKey("frequency"))
            config.setFrequency(body.get("frequency").toString());
        if (body.containsKey("everyN"))
            config.setEveryN(Integer.parseInt(body.get("everyN").toString()));

        tourConfigRepository.save(config);
        return ResponseEntity.ok(toMap(config));
    }

    private Map<String, Object> toMap(TourConfig c) {
        return Map.of(
                "enabled",   c.getEnabled(),
                "frequency", c.getFrequency(),
                "everyN",    c.getEveryN()
        );
    }
}
