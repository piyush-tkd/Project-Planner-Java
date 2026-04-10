CREATE TABLE dashboard_config (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    owner_username VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_template BOOLEAN DEFAULT FALSE,
    template_name VARCHAR(100),
    config JSONB NOT NULL DEFAULT '{}',
    thumbnail_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dashboard_config_owner ON dashboard_config(owner_username);
