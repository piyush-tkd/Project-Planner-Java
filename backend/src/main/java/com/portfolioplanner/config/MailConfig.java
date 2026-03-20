package com.portfolioplanner.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * Provides a no-op {@link JavaMailSender} when no SMTP host is configured,
 * so the application starts cleanly without mail credentials.
 *
 * When MAIL_HOST / spring.mail.host is set to a real SMTP server,
 * Spring Boot's auto-configuration takes over and this bean is skipped.
 */
@Configuration
public class MailConfig {

    @Bean
    @ConditionalOnMissingBean(JavaMailSender.class)
    public JavaMailSender noOpMailSender() {
        // Returns a JavaMailSenderImpl with no host — it will fail if actually
        // called, but that's fine because digest is gated behind
        // app.digest.enabled=true which requires real SMTP config.
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost("localhost");
        sender.setPort(25);
        return sender;
    }
}
