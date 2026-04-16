package com.portfolioplanner.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;

/**
 * Spring Security OAuth2 configuration.
 *
 * <p>The {@link RefreshableSsoClientRegistrationRepository} is a {@code @Component}
 * that implements {@link ClientRegistrationRepository} and supports hot-reloading
 * of SSO configuration without server restart.
 *
 * <p>On startup, the bean is automatically refreshed to load the initial configuration.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class SsoClientRegistrationConfig {

    private final RefreshableSsoClientRegistrationRepository refreshableRepo;

    /**
     * Initialize the SSO registration on startup.
     */
    @Bean
    public ClientRegistrationRepository clientRegistrationRepository() {
        refreshableRepo.refresh();
        return refreshableRepo;
    }
}
