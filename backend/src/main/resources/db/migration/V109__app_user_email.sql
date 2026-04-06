-- V109: Add email address to app_user
-- Required for password-reset flow and SSO account matching.
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Optional: add a unique index once existing rows have been populated
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_email ON app_user(email) WHERE email IS NOT NULL;
