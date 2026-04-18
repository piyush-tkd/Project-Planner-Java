package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.TourConfig;
import com.portfolioplanner.domain.model.UserTourState;
import com.portfolioplanner.domain.repository.TourConfigRepository;
import com.portfolioplanner.domain.repository.UserTourStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TourService {

    private final TourConfigRepository tourConfigRepository;
    private final UserTourStateRepository userTourStateRepository;

    public Map<String, Object> getStatus(String username) {
        TourConfig config = tourConfigRepository.findAll().stream().findFirst()
            .orElseGet(() -> tourConfigRepository.save(new TourConfig()));

        if (!config.getEnabled() || "disabled".equals(config.getFrequency())) {
            return Map.of("showTour", false, "config", toMap(config));
        }

        UserTourState state = userTourStateRepository.findByUsername(username).orElse(null);

        boolean show = switch (config.getFrequency()) {
            case "every_login" -> true;
            case "first_login" -> state == null || state.getSeenCount() == 0;
            case "every_n" -> {
                if (state == null || state.getLastSeenAt() == null) yield true;
                long daysSince = ChronoUnit.DAYS.between(state.getLastSeenAt(), LocalDateTime.now());
                yield daysSince >= config.getEveryN();
            }
            default -> false;
        };

        return Map.of("showTour", show, "config", toMap(config));
    }

    @Transactional
    public void markSeen(String username) {
        UserTourState state = userTourStateRepository.findByUsername(username)
            .orElseGet(() -> {
                UserTourState s = new UserTourState();
                s.setUsername(username);
                return s;
            });
        state.setSeenCount(state.getSeenCount() + 1);
        state.setLastSeenAt(LocalDateTime.now());
        userTourStateRepository.save(state);
    }

    public Map<String, Object> getConfig() {
        TourConfig config = tourConfigRepository.findAll().stream().findFirst()
            .orElseGet(() -> tourConfigRepository.save(new TourConfig()));
        return toMap(config);
    }

    @Transactional
    public Map<String, Object> updateConfig(Map<String, Object> body) {
        TourConfig config = tourConfigRepository.findAll().stream().findFirst()
            .orElseGet(() -> tourConfigRepository.save(new TourConfig()));

        if (body.containsKey("enabled"))
            config.setEnabled(Boolean.parseBoolean(body.get("enabled").toString()));
        if (body.containsKey("frequency"))
            config.setFrequency(body.get("frequency").toString());
        if (body.containsKey("everyN"))
            config.setEveryN(Integer.parseInt(body.get("everyN").toString()));

        tourConfigRepository.save(config);
        return toMap(config);
    }

    private Map<String, Object> toMap(TourConfig c) {
        return Map.of(
            "enabled",   c.getEnabled(),
            "frequency", c.getFrequency(),
            "everyN",    c.getEveryN()
        );
    }
}
