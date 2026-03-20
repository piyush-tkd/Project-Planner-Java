package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.TimelineConfig;
import com.portfolioplanner.domain.repository.TimelineConfigRepository;
import com.portfolioplanner.dto.request.TimelineConfigRequest;
import com.portfolioplanner.dto.response.TimelineConfigResponse;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TimelineService {

    private final TimelineConfigRepository timelineRepository;
    private final EntityMapper mapper;

    public TimelineConfigResponse getCurrentConfig() {
        TimelineConfig config = timelineRepository.findAll().stream()
                .findFirst()
                .orElse(null);
        Map<Integer, String> monthLabels = getMonthLabels(config);
        // Return a sensible default response when no config row exists yet
        if (config == null) {
            config = new TimelineConfig();
            config.setStartYear(LocalDate.now().getYear());
            config.setStartMonth(LocalDate.now().getMonthValue());
            config.setCurrentMonthIndex(1);
            // Default 160 h/month for all 12 months
            Map<String, Integer> defaultHours = new LinkedHashMap<>();
            for (int m = 1; m <= 12; m++) defaultHours.put("M" + m, 160);
            config.setWorkingHours(defaultHours);
        }
        return mapper.toTimelineResponse(config, monthLabels);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public TimelineConfigResponse update(TimelineConfigRequest request) {
        TimelineConfig config = timelineRepository.findAll().stream()
                .findFirst()
                .orElseGet(TimelineConfig::new);

        config.setStartYear(request.startYear());
        config.setStartMonth(request.startMonth());
        config.setCurrentMonthIndex(request.currentMonthIndex());
        config.setWorkingHours(request.workingHours());

        config = timelineRepository.save(config);
        Map<Integer, String> monthLabels = getMonthLabels(config);
        return mapper.toTimelineResponse(config, monthLabels);
    }

    public Map<Integer, String> getMonthLabels() {
        TimelineConfig config = timelineRepository.findAll().stream()
                .findFirst()
                .orElse(null);
        return getMonthLabels(config);
    }

    private Map<Integer, String> getMonthLabels(TimelineConfig config) {
        Map<Integer, String> labels = new LinkedHashMap<>();
        // Fall back to current calendar year/month when no timeline has been configured yet
        int startMonth = config != null ? config.getStartMonth() : LocalDate.now().getMonthValue();
        int startYear  = config != null ? config.getStartYear()  : LocalDate.now().getYear();

        for (int i = 1; i <= 12; i++) {
            int monthOfYear = ((startMonth - 1 + (i - 1)) % 12) + 1;
            int year = startYear + ((startMonth - 1 + (i - 1)) / 12);
            String monthName = Month.of(monthOfYear).getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            String yearSuffix = String.valueOf(year % 100);
            labels.put(i, monthName + "-" + yearSuffix);
        }

        return labels;
    }
}
