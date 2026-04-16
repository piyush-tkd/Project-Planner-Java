package com.portfolioplanner.config;

/**
 * SSO client registration is managed by {@link RefreshableSsoClientRegistrationRepository},
 * which is a {@code @Component} + {@code @Primary} bean that self-initializes via
 * {@code @PostConstruct} and supports hot-reloading without server restart.
 *
 * <p>This class is intentionally empty — kept as a placeholder for documentation.
 */
public class SsoClientRegistrationConfig {
}
