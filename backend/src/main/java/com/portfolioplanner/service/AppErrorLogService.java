package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.AppErrorLog;
import com.portfolioplanner.domain.repository.AppErrorLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AppErrorLogService {

    private final AppErrorLogRepository repo;

    @Transactional
    public AppErrorLog logError(Map<String, Object> body, Authentication auth) {
        AppErrorLog log = new AppErrorLog();
        log.setSource(str(body, "source", "FRONTEND"));
        log.setSeverity(str(body, "severity", "ERROR"));
        log.setErrorType(str(body, "errorType", null));
        log.setMessage(str(body, "message", "Unknown error"));
        log.setStackTrace(str(body, "stackTrace", null));
        log.setPageUrl(str(body, "pageUrl", null));
        log.setApiEndpoint(str(body, "apiEndpoint", null));
        log.setUserAgent(str(body, "userAgent", null));
        log.setComponent(str(body, "component", null));
        if (body.get("httpStatus") instanceof Number n) log.setHttpStatus(n.intValue());
        log.setUsername(auth != null ? auth.getName() : str(body, "username", null));
        log.setResolved(false);
        return repo.save(log);
    }

    public List<AppErrorLog> getAll() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    public Map<String, Object> getSummary() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total",          repo.count());
        m.put("unresolved",     repo.countByResolvedFalse());
        m.put("frontendCount",  repo.countBySource("FRONTEND"));
        m.put("backendCount",   repo.countBySource("BACKEND"));
        m.put("errorCount",     repo.countBySeverity("ERROR"));
        m.put("warnCount",      repo.countBySeverity("WARN"));
        return m;
    }

    @Transactional
    public AppErrorLog resolve(Long id) {
        AppErrorLog log = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Log entry not found"));
        log.setResolved(true);
        return repo.save(log);
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Log entry not found");
        repo.deleteById(id);
    }

    @Transactional
    public long clearResolved() {
        List<AppErrorLog> resolved = repo.findAllByOrderByCreatedAtDesc().stream()
                .filter(l -> Boolean.TRUE.equals(l.getResolved()))
                .toList();
        repo.deleteAll(resolved);
        return resolved.size();
    }

    private String str(Map<String, Object> m, String key, String def) {
        Object v = m.get(key);
        return v != null ? v.toString() : def;
    }
}
