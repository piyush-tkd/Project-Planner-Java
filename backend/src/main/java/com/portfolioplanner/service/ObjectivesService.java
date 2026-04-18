package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.ObjectiveProjectLink;
import com.portfolioplanner.domain.model.Project;
import com.portfolioplanner.domain.model.StrategicObjective;
import com.portfolioplanner.domain.repository.ObjectiveProjectLinkRepository;
import com.portfolioplanner.domain.repository.ProjectRepository;
import com.portfolioplanner.domain.repository.StrategicObjectiveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ObjectivesService {

    private final StrategicObjectiveRepository repo;
    private final ObjectiveProjectLinkRepository linkRepo;
    private final ProjectRepository projectRepo;

    public List<StrategicObjective> getAll(String status, String quarter) {
        if (quarter != null && !quarter.isBlank())
            return repo.findByQuarterOrderByCreatedAtDesc(quarter);
        if (status != null && !status.isBlank())
            return repo.findByStatusOrderByCreatedAtDesc(status);
        return repo.findAllByOrderByCreatedAtDesc();
    }

    public Map<String, Long> getSummary() {
        List<StrategicObjective> all = repo.findAll();
        return all.stream()
            .collect(Collectors.groupingBy(StrategicObjective::getStatus, Collectors.counting()));
    }

    public Optional<StrategicObjective> getById(Long id) {
        return repo.findById(id);
    }

    @Transactional
    public StrategicObjective create(String title, String description, String owner,
                                     String status, Integer progress, String targetDate, String quarter) {
        StrategicObjective obj = new StrategicObjective();
        obj.setStatus("NOT_STARTED");
        obj.setProgress(0);
        obj.setTitle(title);
        if (description != null) obj.setDescription(description);
        if (owner != null) obj.setOwner(owner);
        if (status != null) obj.setStatus(status);
        if (progress != null) obj.setProgress(progress);
        if (targetDate != null && !targetDate.isBlank())
            obj.setTargetDate(LocalDate.parse(targetDate));
        if (quarter != null) obj.setQuarter(quarter);
        return repo.save(obj);
    }

    @Transactional
    public Optional<StrategicObjective> update(Long id, String title, String description, String owner,
                                               String status, Integer progress, String targetDate, String quarter) {
        return repo.findById(id).map(obj -> {
            obj.setTitle(title);
            if (description != null) obj.setDescription(description);
            if (owner != null) obj.setOwner(owner);
            if (status != null) obj.setStatus(status);
            if (progress != null) obj.setProgress(progress);
            if (targetDate != null && !targetDate.isBlank())
                obj.setTargetDate(LocalDate.parse(targetDate));
            if (quarter != null) obj.setQuarter(quarter);
            return repo.save(obj);
        });
    }

    @Transactional
    public Optional<StrategicObjective> updateStatus(Long id, String status, Integer progress) {
        return repo.findById(id).map(obj -> {
            obj.setStatus(status);
            if (progress != null) obj.setProgress(progress);
            return repo.save(obj);
        });
    }

    @Transactional
    public boolean delete(Long id) {
        if (!repo.existsById(id)) return false;
        repo.deleteById(id);
        return true;
    }

    public List<ObjectiveProjectLink> getLinks(Long id) {
        return linkRepo.findByObjectiveId(id);
    }

    public List<Project> getLinkedProjects(Long objectiveId) {
        return linkRepo.findByObjectiveId(objectiveId).stream()
            .map(link -> projectRepo.findById(link.getProjectId()))
            .filter(Optional::isPresent)
            .map(Optional::get)
            .toList();
    }

    @Transactional
    public Optional<ObjectiveProjectLink> addLink(Long objectiveId, Long projectId) {
        if (!repo.existsById(objectiveId)) return Optional.empty();
        if (!projectRepo.existsById(projectId)) return Optional.empty();

        if (!linkRepo.existsByObjectiveIdAndProjectId(objectiveId, projectId)) {
            ObjectiveProjectLink link = new ObjectiveProjectLink();
            link.setObjectiveId(objectiveId);
            link.setProjectId(projectId);
            linkRepo.save(link);
            recomputeProgress(objectiveId);
        }
        return Optional.of(new ObjectiveProjectLink());
    }

    @Transactional
    public void removeLink(Long objectiveId, Long projectId) {
        linkRepo.deleteByObjectiveIdAndProjectId(objectiveId, projectId);
        recomputeProgress(objectiveId);
    }

    private int deriveProgress(Project p) {
        String s = p.getStatus() == null ? "" : p.getStatus().toUpperCase();
        if (s.equals("COMPLETED"))   return 100;
        if (s.equals("CANCELLED"))   return 0;
        if (s.equals("NOT_STARTED")) return 0;
        LocalDate start  = p.getStartDate();
        LocalDate target = p.getTargetDate();
        if (start != null && target != null && !target.isBefore(start)) {
            long total   = ChronoUnit.DAYS.between(start, target);
            long elapsed = ChronoUnit.DAYS.between(start, LocalDate.now());
            if (total > 0) {
                int pct = (int) Math.min(95, Math.max(0, (elapsed * 100) / total));
                return pct;
            }
        }
        return 10;
    }

    private void recomputeProgress(Long objectiveId) {
        List<ObjectiveProjectLink> links = linkRepo.findByObjectiveId(objectiveId);
        if (links.isEmpty()) return;
        double avg = links.stream()
            .map(link -> projectRepo.findById(link.getProjectId()).orElse(null))
            .filter(p -> p != null)
            .mapToInt(this::deriveProgress)
            .average()
            .orElse(0);
        repo.findById(objectiveId).ifPresent(obj -> {
            obj.setProgress((int) Math.round(avg));
            repo.save(obj);
        });
    }
}
