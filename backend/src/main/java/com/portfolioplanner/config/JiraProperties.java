package com.portfolioplanner.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "jira")
public class JiraProperties {

    private String baseUrl = "";
    private String email = "";
    private String apiToken = "";

    public String getBaseUrl()   { return baseUrl; }
    public String getEmail()     { return email; }
    public String getApiToken()  { return apiToken; }

    public void setBaseUrl(String v)   { this.baseUrl = v; }
    public void setEmail(String v)     { this.email = v; }
    public void setApiToken(String v)  { this.apiToken = v; }

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank()
            && email != null && !email.isBlank()
            && apiToken != null && !apiToken.isBlank();
    }
}
