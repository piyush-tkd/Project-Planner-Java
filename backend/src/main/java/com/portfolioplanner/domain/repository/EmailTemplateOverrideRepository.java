package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.EmailTemplateOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailTemplateOverrideRepository extends JpaRepository<EmailTemplateOverride, Long> {

    Optional<EmailTemplateOverride> findByOrgIdAndTemplateName(Long orgId, String templateName);

    List<EmailTemplateOverride> findAllByOrgId(Long orgId);

    void deleteByOrgIdAndTemplateName(Long orgId, String templateName);
}
