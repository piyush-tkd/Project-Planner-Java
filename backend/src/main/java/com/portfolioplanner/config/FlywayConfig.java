package com.portfolioplanner.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Logs the active Flyway configuration at startup so operators can confirm
 * whether strict validation is on (expected in prod) or permissive (dev/test).
 */
@Component
@ConditionalOnBean(Flyway.class)
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

    @Value("${spring.flyway.validate-on-migrate:true}")
    private boolean validateOnMigrate;

    @Value("${spring.flyway.out-of-order:false}")
    private boolean outOfOrder;

    @Value("${spring.flyway.repair-on-migrate:false}")
    private boolean repairOnMigrate;

    private final Flyway flyway;

    public FlywayConfig(Flyway flyway) {
        this.flyway = flyway;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void logFlywayConfig() {
        int applied = flyway.info().applied().length;
        log.info("[Flyway] validate-on-migrate={} | out-of-order={} | repair-on-migrate={} | applied-migrations={}",
                validateOnMigrate, outOfOrder, repairOnMigrate, applied);
    }
}
