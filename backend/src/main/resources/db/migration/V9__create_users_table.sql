-- Users table for JWT authentication
CREATE TABLE IF NOT EXISTS app_user (
    id       BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role     VARCHAR(50)  NOT NULL DEFAULT 'ADMIN',
    enabled  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Default admin user: username=admin, password=admin
-- BCrypt hash of "admin" with strength 10
INSERT INTO app_user (username, password, role, enabled)
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN', TRUE)
ON CONFLICT (username) DO NOTHING;
