-- V83: Introduce role_definition table so roles are first-class entities.
--
-- Design:
--   - role_definition stores named roles with display metadata.
--   - The existing page_permission and role_privilege tables already key on
--     the role *name string*, so no FK migration is needed — they continue to
--     work as-is.  role_definition simply adds discoverability + CRUD.
--   - is_system = TRUE rows cannot be deleted via the API.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_definition (
    id           BIGSERIAL    PRIMARY KEY,
    name         VARCHAR(50)  NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
    color        VARCHAR(20)  NOT NULL DEFAULT 'blue',
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Seed the four roles that already exist in the system.
INSERT INTO role_definition (name, display_name, description, is_system, color) VALUES
  ('SUPER_ADMIN', 'Super Admin',   'Unrestricted access to everything, including system configuration', TRUE, 'red'),
  ('ADMIN',       'Admin',         'Full access; can manage users, roles and org settings',             TRUE, 'orange'),
  ('READ_WRITE',  'Read / Write',  'Can view and edit portfolio content; admin pages restricted',       TRUE, 'blue'),
  ('READ_ONLY',   'Read Only',     'View-only access to portfolio content',                              TRUE, 'gray')
ON CONFLICT (name) DO NOTHING;
