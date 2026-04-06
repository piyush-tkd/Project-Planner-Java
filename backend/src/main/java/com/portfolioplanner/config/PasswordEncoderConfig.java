package com.portfolioplanner.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Standalone configuration for the {@link PasswordEncoder} bean.
 *
 * <p>Extracted from {@link SecurityConfig} to break the circular dependency:
 * <pre>
 *   SecurityConfig → SsoAuthSuccessHandler → PasswordEncoder (defined in SecurityConfig)
 * </pre>
 * By placing {@code PasswordEncoder} in its own configuration class it has no
 * dependency on either {@code SecurityConfig} or {@code SsoAuthSuccessHandler},
 * so Spring can initialise all three beans without a cycle.
 */
@Configuration
public class PasswordEncoderConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
