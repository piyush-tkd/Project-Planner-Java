package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.OrgSettings;
import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.ProjectApproval;
import com.portfolioplanner.domain.model.ProjectPodPlanning;
import com.portfolioplanner.domain.model.TimelineConfig;
import com.portfolioplanner.domain.repository.OrgSettingsRepository;
import com.portfolioplanner.domain.repository.PodRepository;
import com.portfolioplanner.domain.repository.ProjectApprovalRepository;
import com.portfolioplanner.domain.repository.ReleaseCalendarRepository;
import com.portfolioplanner.domain.model.ReleaseCalendar;
import com.portfolioplanner.domain.repository.ProjectPodPlanningRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.TimelineConfigRepository;
import com.portfolioplanner.dto.request.ProjectPodPlanningRequest;
import com.portfolioplanner.dto.request.ProjectRequest;
import com.portfolioplanner.dto.response.ProjectPodMatrixResponse;
import com.portfolioplanner.dto.response.ProjectPodPlanningResponse;
import com.portfolioplanner.dto.response.ProjectResponse;
import com.portfolioplanner.exception.DuplicateNameException;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import com.portfolioplanner.service.ai.ProjectChangedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectService {

    @Value("${app.org-id:1}")
    private Long orgId;

    private final ProjectRepository projectRepository;
    private final ProjectPodPlanningRepository planningRepository;
    private final PodRepository podRepository;
    private final ReleaseCalendarRepository releaseCalendarRepository;
    private final TimelineConfigRepository timelineRepository;
    private final EntityMapper mapper;
    private final AuditLogService auditLogService;
    private final WebhookService webhookService;
    private final OrgSettingsRepository orgSettingsRepository;
    private final ProjectApprovalRepository approvalRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ApprovalNotificationService approvalNotificationService;

    public List<ProjectResponse> getAll(String status) {
        List<Project> projects;
        if (status != null && !status.isBlank()) {
            projects = projectRepository.findByStatusIgnoreCase(status);
        } else {
            projects = projectRepository.findAll();
        }
        return mapper.toProjectResponseList(projects);
    }

    public ProjectResponse getById(Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));
        return mapper.toProjectResponse(project);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ProjectResponse create(ProjectRequest request) {
        // For JIRA_SYNCED projects: deduplicate by jiraEpicKey first, then by name
        if (request.jiraEpicKey() != null && !request.jiraEpicKey().isBlank()) {
            projectRepository.findByJiraEpicKey(request.jiraEpicKey()).ifPresent(existing -> {
                throw new DuplicateNameException("A project linked to Jira key " + request.jiraEpicKey() + " already exists: " + existing.getName());
            });
        }
        // Check for duplicate name
        if (projectRepository.findByNameIgnoreCase(request.name()).isPresent()) {
            throw new DuplicateNameException("A project with this name already exists");
        }

        Project project = mapper.toEntity(request);
        if (project.getStatus() == null) project.setStatus("NOT_STARTED");

        // Apply source type from request (defaults to MANUAL via entity default)
        if (request.sourceType() != null && !request.sourceType().isBlank()) {
            try {
                project.setSourceType(com.portfolioplanner.domain.model.enums.SourceType.valueOf(request.sourceType().toUpperCase()));
            } catch (IllegalArgumentException ignored) {
                // unknown value → keep default MANUAL
            }
        }
        // Apply jiraEpicKey from request
        if (request.jiraEpicKey() != null && !request.jiraEpicKey().isBlank()) {
            project.setJiraEpicKey(request.jiraEpicKey());
            if (project.getSourceType() == com.portfolioplanner.domain.model.enums.SourceType.MANUAL) {
                project.setSourceType(com.portfolioplanner.domain.model.enums.SourceType.JIRA_SYNCED);
            }
        }

        if (request.blockedById() != null) {
            Project blockedBy = projectRepository.findById(request.blockedById())
                    .orElseThrow(() -> new ResourceNotFoundException("Project", request.blockedById()));
            project.setBlockedBy(blockedBy);
        }
        deriveMonthFieldsFromDates(project);
        project = projectRepository.save(project);
        auditLogService.log("Project", project.getId(), project.getName(), "CREATE",
                projectSnapshot(project));
        eventPublisher.publishEvent(new ProjectChangedEvent(project.getId()));
        return mapper.toProjectResponse(project);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    @CacheEvict(value = "calculations", allEntries = true)
    public ProjectResponse update(Long id, ProjectRequest request) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));

        // Check for duplicate name, excluding the current project
        projectRepository.findByNameIgnoreCase(request.name()).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new DuplicateNameException("A project with this name already exists");
            }
        });

        // ── Approval gate for status changes ─────────────────────────────────
        String currentStatus = project.getStatus();
        String requestedStatus = request.status() != null ? request.status().toUpperCase() : currentStatus;
        if (!currentStatus.equalsIgnoreCase(requestedStatus)
                && isApprovalRequired("approval.require_status")) {
            approvalRepository.findFirstByProjectIdAndStatusOrderByRequestedAtDesc(
                    id, ProjectApproval.ApprovalStatus.PENDING).ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "PENDING_APPROVAL_EXISTS");
            });
            ProjectApproval a = new ProjectApproval();
            a.setProjectId(id);
            a.setRequestedBy(getCurrentUsername());
            a.setProposedChange("STATUS:" + currentStatus + "→" + requestedStatus);
            a.setRequestNote("Status transition requested: " + currentStatus + " → " + requestedStatus);
            a.setStatus(ProjectApproval.ApprovalStatus.PENDING);
            approvalRepository.save(a);
            approvalNotificationService.notifyNewApprovalPending(a,
                    project.getName(), "Status: " + currentStatus + " → " + requestedStatus);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "APPROVAL_REQUIRED");
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── Approval gate for timeline extensions ─────────────────────────────
        Integer currentEnd = project.getTargetEndMonth();
        Integer requestedEnd = request.targetEndMonth();
        if (requestedEnd != null && currentEnd != null
                && requestedEnd > currentEnd
                && isApprovalRequired("approval.require_timeline")) {
            approvalRepository.findFirstByProjectIdAndStatusOrderByRequestedAtDesc(
                    id, ProjectApproval.ApprovalStatus.PENDING).ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "PENDING_APPROVAL_EXISTS");
            });
            ProjectApproval a = new ProjectApproval();
            a.setProjectId(id);
            a.setRequestedBy(getCurrentUsername());
            a.setProposedChange("TIMELINE:" + currentEnd + "→" + requestedEnd);
            a.setRequestNote("Timeline extension requested: month " + currentEnd + " → month " + requestedEnd);
            a.setStatus(ProjectApproval.ApprovalStatus.PENDING);
            approvalRepository.save(a);
            approvalNotificationService.notifyNewApprovalPending(a,
                    project.getName(), "Timeline extended: month " + currentEnd + " → month " + requestedEnd);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "APPROVAL_REQUIRED");
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── Approval gate for budget increases ────────────────────────────────
        BigDecimal currentBudget = project.getEstimatedBudget();
        BigDecimal requestedBudget = request.estimatedBudget();
        if (requestedBudget != null && currentBudget != null
                && requestedBudget.compareTo(currentBudget) > 0
                && isApprovalRequired("approval.require_budget")) {
            approvalRepository.findFirstByProjectIdAndStatusOrderByRequestedAtDesc(
                    id, ProjectApproval.ApprovalStatus.PENDING).ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "PENDING_APPROVAL_EXISTS");
            });
            ProjectApproval a = new ProjectApproval();
            a.setProjectId(id);
            a.setRequestedBy(getCurrentUsername());
            a.setProposedChange("BUDGET:" + currentBudget.toPlainString() + "→" + requestedBudget.toPlainString());
            a.setRequestNote("Budget increase requested: " + currentBudget.toPlainString() + " → " + requestedBudget.toPlainString());
            a.setStatus(ProjectApproval.ApprovalStatus.PENDING);
            approvalRepository.save(a);
            approvalNotificationService.notifyNewApprovalPending(a,
                    project.getName(), "Budget increase: $" + currentBudget.toPlainString() + " → $" + requestedBudget.toPlainString());
            throw new ResponseStatusException(HttpStatus.CONFLICT, "APPROVAL_REQUIRED");
        }
        // ─────────────────────────────────────────────────────────────────────

        // Capture before-state for diff
        String beforeDetails = projectSnapshot(project);
        mapper.updateEntity(request, project);
        if (request.blockedById() != null) {
            Project blockedBy = projectRepository.findById(request.blockedById())
                    .orElseThrow(() -> new ResourceNotFoundException("Project", request.blockedById()));
            project.setBlockedBy(blockedBy);
        } else {
            project.setBlockedBy(null);
        }
        deriveMonthFieldsFromDates(project);
        project = projectRepository.save(project);
        auditLogService.log("Project", project.getId(), project.getName(), "UPDATE",
                projectDiff(beforeDetails, projectSnapshot(project)));
        eventPublisher.publishEvent(new ProjectChangedEvent(project.getId()));
        return mapper.toProjectResponse(project);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    @CacheEvict(value = "calculations", allEntries = true)
    public ProjectResponse patchStatus(Long id, String newStatus) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));
        String before = project.getStatus();
        String desired = newStatus.toUpperCase();

        // ── Approval gate ────────────────────────────────────────────────────
        if (isApprovalRequired("approval.require_status") && !before.equalsIgnoreCase(desired)) {
            // Block if there's already a pending approval for this project
            approvalRepository.findFirstByProjectIdAndStatusOrderByRequestedAtDesc(
                    id, ProjectApproval.ApprovalStatus.PENDING).ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "PENDING_APPROVAL_EXISTS");
            });
            // Auto-create the pending approval and reject the direct save
            ProjectApproval a = new ProjectApproval();
            a.setProjectId(id);
            a.setRequestedBy(getCurrentUsername());
            a.setProposedChange("STATUS:" + before + "→" + desired);
            a.setRequestNote("Status transition requested: " + before + " → " + desired);
            a.setStatus(ProjectApproval.ApprovalStatus.PENDING);
            approvalRepository.save(a);
            approvalNotificationService.notifyNewApprovalPending(a, project.getName(),
                    "Status: " + before + " → " + desired);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "APPROVAL_REQUIRED");
        }
        // ────────────────────────────────────────────────────────────────────

        project.setStatus(desired);
        project = projectRepository.save(project);
        auditLogService.log("Project", project.getId(), project.getName(), "STATUS_CHANGE",
                "status: " + before + " → " + project.getStatus());
        webhookService.fireProjectStatusChanged(
                project.getId(), project.getName(), before, project.getStatus());
        eventPublisher.publishEvent(new ProjectChangedEvent(project.getId()));
        return mapper.toProjectResponse(project);
    }

    /**
     * Apply the proposed change stored on an approval record.
     * Called automatically when a reviewer approves the request.
     */
    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void applyProposedChange(Long projectId, String proposedChange) {
        if (proposedChange == null || proposedChange.isBlank()) return;
        if (proposedChange.startsWith("STATUS:")) {
            // FORMAT: "STATUS:BEFORE→AFTER"
            String[] parts = proposedChange.substring("STATUS:".length()).split("→", 2);
            if (parts.length == 2) {
                String newStatus = parts[1];
                Project project = projectRepository.findById(projectId).orElse(null);
                if (project != null) {
                    String before = project.getStatus();
                    project.setStatus(newStatus);
                    projectRepository.save(project);
                    auditLogService.log("Project", project.getId(), project.getName(),
                            "STATUS_CHANGE", "status: " + before + " → " + newStatus + " (auto-applied via approval)");
                    webhookService.fireProjectStatusChanged(
                            project.getId(), project.getName(), before, newStatus);
                }
            }
        } else if (proposedChange.startsWith("TIMELINE:")) {
            // FORMAT: "TIMELINE:OLD_MONTH→NEW_MONTH"
            String[] parts = proposedChange.substring("TIMELINE:".length()).split("→", 2);
            if (parts.length == 2) {
                try {
                    int newEndMonth = Integer.parseInt(parts[1]);
                    Project project = projectRepository.findById(projectId).orElse(null);
                    if (project != null) {
                        project.setTargetEndMonth(newEndMonth);
                        projectRepository.save(project);
                        auditLogService.log("Project", project.getId(), project.getName(),
                                "TIMELINE_CHANGE", "targetEndMonth: " + parts[0] + " → " + newEndMonth + " (auto-applied via approval)");
                    }
                } catch (NumberFormatException ignored) { }
            }
        } else if (proposedChange.startsWith("BUDGET:")) {
            // FORMAT: "BUDGET:OLD_AMOUNT→NEW_AMOUNT"
            String[] parts = proposedChange.substring("BUDGET:".length()).split("→", 2);
            if (parts.length == 2) {
                try {
                    BigDecimal newBudget = new BigDecimal(parts[1]);
                    Project project = projectRepository.findById(projectId).orElse(null);
                    if (project != null) {
                        project.setEstimatedBudget(newBudget);
                        projectRepository.save(project);
                        auditLogService.log("Project", project.getId(), project.getName(),
                                "BUDGET_CHANGE", "estimatedBudget: " + parts[0] + " → " + newBudget.toPlainString() + " (auto-applied via approval)");
                    }
                } catch (NumberFormatException ignored) { }
            }
        }
    }

    /**
     * Returns the username of the currently authenticated user, or {@code "system"}
     * as a safe fallback for unauthenticated/background calls.
     */
    private String getCurrentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return "system";
        }
        return auth.getName();
    }

    /** Check if an approval feature flag is enabled in OrgSettings. */
    private boolean isApprovalRequired(String featureKey) {
        Map<String, Boolean> features = orgSettingsRepository.findByOrgId(orgId)
                .map(OrgSettings::getFeatures)
                .orElse(null);
        if (features == null) return false;
        // If auto-approve is globally enabled, bypass human review for all gates
        if (Boolean.TRUE.equals(features.get("approval.auto_approve"))) return false;
        return Boolean.TRUE.equals(features.get(featureKey));
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public void delete(Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));
        String name = project.getName();
        String snapshot = projectSnapshot(project);
        List<ProjectPodPlanning> plannings = planningRepository.findByProjectId(id);
        planningRepository.deleteAll(plannings);
        projectRepository.deleteById(id);
        auditLogService.log("Project", id, name, "DELETE", snapshot);
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public ProjectResponse copy(Long id) {
        Project original = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));

        // Create a new project with copied fields
        Project copy = new Project();
        copy.setName(original.getName() + " (Copy)");
        copy.setPriority(original.getPriority());
        copy.setOwner(original.getOwner());
        copy.setStartMonth(original.getStartMonth());
        copy.setTargetEndMonth(original.getTargetEndMonth());
        copy.setDurationMonths(original.getDurationMonths());
        copy.setDefaultPattern(original.getDefaultPattern());
        copy.setNotes(original.getNotes());
        copy.setStatus("NOT_STARTED");
        copy.setBlockedBy(original.getBlockedBy());
        copy.setTargetDate(original.getTargetDate());
        copy.setStartDate(original.getStartDate());
        copy.setCapacityNote(original.getCapacityNote());
        copy.setClient(original.getClient());

        copy = projectRepository.save(copy);

        // ── Also copy all POD assignments and their estimates ──
        List<ProjectPodPlanning> originalPlannings = planningRepository.findByProjectId(id);
        for (ProjectPodPlanning orig : originalPlannings) {
            ProjectPodPlanning cloned = new ProjectPodPlanning();
            cloned.setProject(copy);
            cloned.setPod(orig.getPod());
            cloned.setTshirtSize(orig.getTshirtSize());
            cloned.setComplexityOverride(orig.getComplexityOverride());
            cloned.setEffortPattern(orig.getEffortPattern());
            cloned.setPodStartMonth(orig.getPodStartMonth());
            cloned.setDurationOverride(orig.getDurationOverride());
            cloned.setDevHours(orig.getDevHours());
            cloned.setQaHours(orig.getQaHours());
            cloned.setBsaHours(orig.getBsaHours());
            cloned.setTechLeadHours(orig.getTechLeadHours());
            cloned.setContingencyPct(orig.getContingencyPct());
            cloned.setTargetRelease(orig.getTargetRelease());
            cloned.setDevStartDate(orig.getDevStartDate());
            cloned.setDevEndDate(orig.getDevEndDate());
            cloned.setQaStartDate(orig.getQaStartDate());
            cloned.setQaEndDate(orig.getQaEndDate());
            cloned.setUatStartDate(orig.getUatStartDate());
            cloned.setUatEndDate(orig.getUatEndDate());
            cloned.setScheduleLocked(orig.getScheduleLocked());
            cloned.setDevCount(orig.getDevCount());
            cloned.setQaCount(orig.getQaCount());
            planningRepository.save(cloned);
        }

        auditLogService.log("Project", copy.getId(), copy.getName(), "COPY",
                "Copied from project ID " + id + " with " + originalPlannings.size() + " POD assignment(s)");
        return mapper.toProjectResponse(copy);
    }

    // ── Audit helpers ─────────────────────────────────────────────────────────

    /** Returns a flat key=value snapshot of the fields most relevant to audit. */
    private String projectSnapshot(Project p) {
        StringBuilder sb = new StringBuilder();
        sb.append("priority=").append(p.getPriority());
        sb.append(", status=").append(p.getStatus());
        if (p.getOwner() != null)      sb.append(", owner=").append(p.getOwner());
        if (p.getStartDate() != null)  sb.append(", startDate=").append(p.getStartDate());
        if (p.getTargetDate() != null) sb.append(", targetDate=").append(p.getTargetDate());
        if (p.getDurationMonths() != null) sb.append(", durationMonths=").append(p.getDurationMonths());
        return sb.toString();
    }

    /**
     * Compares two snapshots produced by {@link #projectSnapshot} and returns
     * only the fields whose values changed, in the form "field: OLD → NEW".
     * Falls back to the full after-snapshot when parsing fails.
     */
    private String projectDiff(String before, String after) {
        try {
            java.util.Map<String, String> bMap = parseSnapshot(before);
            java.util.Map<String, String> aMap = parseSnapshot(after);
            List<String> diffs = new ArrayList<>();
            // Check fields that appear in either snapshot
            java.util.Set<String> keys = new java.util.LinkedHashSet<>();
            keys.addAll(bMap.keySet());
            keys.addAll(aMap.keySet());
            for (String key : keys) {
                String bVal = bMap.getOrDefault(key, "—");
                String aVal = aMap.getOrDefault(key, "—");
                if (!bVal.equals(aVal)) {
                    diffs.add(key + ": " + bVal + " → " + aVal);
                }
            }
            return diffs.isEmpty() ? "no changes" : String.join(", ", diffs);
        } catch (Exception e) {
            return after; // fallback
        }
    }

    private java.util.Map<String, String> parseSnapshot(String snapshot) {
        java.util.Map<String, String> map = new java.util.LinkedHashMap<>();
        if (snapshot == null || snapshot.isBlank()) return map;
        for (String pair : snapshot.split(",\\s*")) {
            int eq = pair.indexOf('=');
            if (eq > 0) {
                map.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
            }
        }
        return map;
    }

    public List<ProjectPodMatrixResponse> getAllPodPlannings() {
        List<ProjectPodPlanning> plannings = planningRepository.findAll();
        return mapper.toProjectPodMatrixResponseList(plannings);
    }

    public List<ProjectPodMatrixResponse> getPodPlanningsByPodId(Long podId) {
        List<ProjectPodPlanning> plannings = planningRepository.findByPodId(podId);
        return mapper.toProjectPodMatrixResponseList(plannings);
    }

    public List<ProjectPodPlanningResponse> getPodPlannings(Long projectId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", projectId);
        }
        List<ProjectPodPlanning> plannings = planningRepository.findByProjectId(projectId);
        return mapper.toPodPlanningResponseList(plannings);
    }

    /**
     * When a project has startDate and targetDate set, derive the month-index fields
     * (startMonth, targetEndMonth, durationMonths) from those dates using the timeline config.
     */
    private void deriveMonthFieldsFromDates(Project project) {
        if (project.getStartDate() == null || project.getTargetDate() == null) return;

        TimelineConfig config = timelineRepository.findAll().stream().findFirst().orElse(null);
        if (config == null) return;

        LocalDate startDate = project.getStartDate();
        LocalDate targetDate = project.getTargetDate();

        // Timeline anchor: the 1st day of the planning horizon's first month
        LocalDate anchorDate = LocalDate.of(config.getStartYear(), config.getStartMonth(), 1);

        // Compute month index (1-based) for start date
        int startMonthIdx = monthsBetween(anchorDate, startDate) + 1;
        startMonthIdx = Math.max(1, Math.min(12, startMonthIdx));

        // Compute month index for target date
        int endMonthIdx = monthsBetween(anchorDate, targetDate) + 1;
        endMonthIdx = Math.max(startMonthIdx, Math.min(12, endMonthIdx));

        int duration = endMonthIdx - startMonthIdx + 1;

        project.setStartMonth(startMonthIdx);
        project.setTargetEndMonth(endMonthIdx);
        project.setDurationMonths(duration);
    }

    private int monthsBetween(LocalDate anchor, LocalDate date) {
        int yearDiff = date.getYear() - anchor.getYear();
        int monthDiff = date.getMonthValue() - anchor.getMonthValue();
        return yearDiff * 12 + monthDiff;
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public List<ProjectPodPlanningResponse> setPodPlannings(Long projectId, List<ProjectPodPlanningRequest> requests) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));

        List<ProjectPodPlanning> existing = planningRepository.findByProjectId(projectId);
        Set<Long> requestPodIds = requests.stream()
                .map(ProjectPodPlanningRequest::podId)
                .collect(Collectors.toSet());

        // Remove plannings not in the new request set
        List<ProjectPodPlanning> toRemove = existing.stream()
                .filter(p -> !requestPodIds.contains(p.getPod().getId()))
                .toList();
        planningRepository.deleteAll(toRemove);

        // Create or update plannings
        List<ProjectPodPlanning> result = new ArrayList<>();
        for (ProjectPodPlanningRequest req : requests) {
            Pod pod = podRepository.findById(req.podId())
                    .orElseThrow(() -> new ResourceNotFoundException("Pod", req.podId()));

            ProjectPodPlanning planning = existing.stream()
                    .filter(p -> p.getPod().getId().equals(req.podId()))
                    .findFirst()
                    .orElseGet(() -> {
                        ProjectPodPlanning newPlanning = new ProjectPodPlanning();
                        newPlanning.setProject(project);
                        newPlanning.setPod(pod);
                        return newPlanning;
                    });

            // Always apply all fields so nullable ones can be cleared by sending null
            planning.setDevHours(req.devHours() != null ? req.devHours() : java.math.BigDecimal.ZERO);
            planning.setQaHours(req.qaHours() != null ? req.qaHours() : java.math.BigDecimal.ZERO);
            planning.setBsaHours(req.bsaHours() != null ? req.bsaHours() : java.math.BigDecimal.ZERO);
            planning.setTechLeadHours(req.techLeadHours() != null ? req.techLeadHours() : java.math.BigDecimal.ZERO);
            planning.setContingencyPct(req.contingencyPct() != null ? req.contingencyPct() : java.math.BigDecimal.ZERO);
            planning.setEffortPattern(req.effortPattern());       // null = use project default
            planning.setPodStartMonth(req.podStartMonth());       // null = use project start
            planning.setDurationOverride(req.durationOverride()); // null = use project duration
            if (req.targetReleaseId() != null) {
                ReleaseCalendar release = releaseCalendarRepository.findById(req.targetReleaseId()).orElse(null);
                planning.setTargetRelease(release);
            } else {
                planning.setTargetRelease(null);                  // null = clear the release link
            }

            // Phase scheduling dates
            planning.setDevStartDate(req.devStartDate());
            planning.setDevEndDate(req.devEndDate());
            planning.setQaStartDate(req.qaStartDate());
            planning.setQaEndDate(req.qaEndDate());
            planning.setUatStartDate(req.uatStartDate());
            planning.setUatEndDate(req.uatEndDate());
            if (req.scheduleLocked() != null) {
                planning.setScheduleLocked(req.scheduleLocked());
            }

            // Resource counts
            if (req.devCount() != null) planning.setDevCount(req.devCount());
            if (req.qaCount() != null) planning.setQaCount(req.qaCount());

            result.add(planningRepository.save(planning));
        }

        return mapper.toPodPlanningResponseList(result);
    }
}
