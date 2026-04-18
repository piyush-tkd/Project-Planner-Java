package com.portfolioplanner.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Creates the target PostgreSQL database if it doesn't already exist.
 *
 * Flyway requires an existing database to connect to — it cannot create one itself.
 * This configuration provides the {@link DataSource} bean (causing Spring Boot's
 * DataSource auto-configuration to back off) and, before returning the real datasource,
 * connects to the {@code postgres} system database and issues a
 * {@code CREATE DATABASE <name>} when the target database is missing.
 *
 * Safe to run on every startup — no-ops if the database already exists.
 */
@Configuration
@EnableConfigurationProperties(DataSourceProperties.class)
public class DatabaseInitializerConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseInitializerConfig.class);

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        maybeCreateDatabase(properties);
        return properties.initializeDataSourceBuilder().build();
    }

    private void maybeCreateDatabase(DataSourceProperties properties) {
        String jdbcUrl = properties.getUrl();
        String username = properties.getUsername();
        String password = properties.getPassword() != null ? properties.getPassword() : "";

        // Extract DB name and build a URL pointing to the postgres system database
        int lastSlash = jdbcUrl.lastIndexOf('/');
        if (lastSlash < 0) {
            log.warn("[DB-Init] Cannot parse database name from URL: {}", jdbcUrl);
            return;
        }
        // Strip any query params (e.g. ?currentSchema=...) from the db name segment
        String dbSegment = jdbcUrl.substring(lastSlash + 1);
        String dbName    = dbSegment.split("[?]")[0];
        String baseUrl   = jdbcUrl.substring(0, lastSlash);
        String postgresUrl = baseUrl + "/postgres";

        try (Connection conn = DriverManager.getConnection(postgresUrl, username, password)) {
            try (PreparedStatement check = conn.prepareStatement(
                    "SELECT 1 FROM pg_database WHERE datname = ?")) {
                check.setString(1, dbName);
                try (ResultSet rs = check.executeQuery()) {
                    if (rs.next()) {
                        log.debug("[DB-Init] Database '{}' already exists — skipping creation", dbName);
                    } else {
                        // identifiers can't be parameterised in PostgreSQL DDL
                        conn.createStatement().execute("CREATE DATABASE \"" + dbName + "\"");
                        log.info("[DB-Init] Created database '{}'", dbName);
                    }
                }
            }
        } catch (Exception ex) {
            // Non-fatal: log and continue — Flyway will fail with a clear error
            // if the database genuinely doesn't exist and couldn't be created.
            log.warn("[DB-Init] Could not auto-create database '{}': {}", dbName, ex.getMessage());
        }
    }
}
