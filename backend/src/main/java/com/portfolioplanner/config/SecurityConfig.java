package com.portfolioplanner.config;

import com.portfolioplanner.security.JwtAuthenticationFilter;
import com.portfolioplanner.security.SsoAuthSuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import jakarta.servlet.DispatcherType;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter      jwtAuthFilter;
    private final UserDetailsService           userDetailsService;
    private final PasswordEncoder              passwordEncoder;
    private final SsoAuthSuccessHandler        ssoSuccessHandler;
    private final ClientRegistrationRepository clientRegistrationRepository;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                // Allow async dispatches (SSE streaming) — security already checked on initial request
                .dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
                // Username+password login
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                // Forgot-password flow — both endpoints are public
                .requestMatchers(HttpMethod.POST, "/api/auth/forgot-password").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/reset-password").permitAll()
                // SSO status check — used by login page before user is authenticated
                .requestMatchers(HttpMethod.GET, "/api/auth/sso-status").permitAll()
                // Spring Security OAuth2 login redirects — must be reachable without a token
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                // H2 console (dev only)
                .requestMatchers("/h2-console/**").permitAll()
                // Avatar proxy — fetched by <img> tags which cannot send JWT headers.
                // The controller enforces its own URL whitelist so this is safe to open.
                .requestMatchers(HttpMethod.GET, "/api/jira/avatar-proxy").permitAll()
                // Everything else requires a valid JWT
                .anyRequest().authenticated()
            )
            // Stateless JWT for regular API calls
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // OAuth2 / OIDC login — only active when clientRegistrationRepository has registrations
            .oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(ep -> ep
                    .baseUri("/oauth2/authorization")
                )
                .redirectionEndpoint(ep -> ep
                    .baseUri("/login/oauth2/code/*")
                )
                .successHandler(ssoSuccessHandler)
                .failureUrl("/login?error=sso_failed")
            );

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        var provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(20_000);
        return new RestTemplate(factory);
    }
}
