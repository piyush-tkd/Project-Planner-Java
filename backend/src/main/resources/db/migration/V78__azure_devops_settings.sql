-- Azure DevOps integration credentials and repo configuration.
-- Single-row table (id = 1), upserted via the service layer.
CREATE TABLE IF NOT EXISTS azure_devops_settings (
    id              BIGINT PRIMARY KEY DEFAULT 1,
    org_url         VARCHAR(500),        -- e.g. https://dev.azure.com/myorg
    project_name    VARCHAR(255),        -- ADO project name
    personal_access_token TEXT,          -- PAT with Code (read) + PR Threads (read)
    repositories    TEXT,                -- comma-separated repo names
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

