package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.DashboardWidget;
import com.portfolioplanner.domain.repository.DashboardWidgetRepository;
import com.portfolioplanner.dto.DashboardWidgetDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardWidgetService {

    private final DashboardWidgetRepository repo;

    // ── Queries ───────────────────────────────────────────────────────────────

    public List<DashboardWidgetDto> listUserWidgets(String username) {
        return repo.findByUsernameOrderByGridRowAscGridColAsc(username)
                   .stream().map(DashboardWidgetDto::from).collect(Collectors.toList());
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Replace all widgets for a user in a single transaction.
     * Deletes existing widgets, then creates new ones from the request.
     */
    @Transactional
    public List<DashboardWidgetDto> bulkSave(String username, List<DashboardWidgetDto.SaveRequest> widgets) {
        repo.deleteByUsername(username);
        List<DashboardWidget> saved = new ArrayList<>();
        if (widgets != null) {
            for (DashboardWidgetDto.SaveRequest req : widgets) {
                DashboardWidget w = new DashboardWidget();
                w.setUsername(username);
                w.setWidgetType(req.getWidgetType());
                w.setTitle(req.getTitle());
                w.setGridCol(req.getGridCol());
                w.setGridRow(req.getGridRow());
                w.setColSpan(req.getColSpan());
                w.setRowSpan(req.getRowSpan());
                w.setConfig(req.getConfig());
                saved.add(repo.save(w));
            }
        }
        return saved.stream().map(DashboardWidgetDto::from).collect(Collectors.toList());
    }

    @Transactional
    public void deleteWidget(Long id, String username) {
        repo.findById(id).ifPresent(w -> {
            if (w.getUsername().equals(username)) {
                repo.delete(w);
            }
        });
    }
}
