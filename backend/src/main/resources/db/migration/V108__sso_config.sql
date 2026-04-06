-- V108: SSO/OIDC configuration table
-- Stores per-org SSO provider config (client credentials, redirect URI, enabled flag).
-- client_secret is stored in plaintext here; production deployments should use
-- a secrets manager or encrypted column converter.

CREATE TYPE sso_provider AS ENUM ('GOOGLE', 'MICROSOFT', 'OKTA', 'CUSTOM');

CREATE TABLE sso_config (
    id              BIGSERIAL PRIMARY KEY,
    org_id          BIGINT NOT NULL UNIQUE,
    provider        sso_provider NOT NULL DEFAULT 'GOOGLE',
    client_id       VARCHAR(500),
    client_secret   VARCHAR(2000),
    redirect_uri    VARCHAR(1000),
    discovery_url   VARCHAR(1000),           -- for CUSTOM / Okta OIDC discovery
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
