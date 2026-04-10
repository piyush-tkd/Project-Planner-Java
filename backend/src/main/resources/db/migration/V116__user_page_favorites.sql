-- V116: User page favorites
-- Persists per-user starred/pinned page shortcuts.
-- page_path   = the React route (e.g. "/projects", "/people/resources")
-- page_label  = human-readable title stored at pin-time (e.g. "Projects")

CREATE TABLE IF NOT EXISTS user_page_favorite (
    id          BIGSERIAL     PRIMARY KEY,
    username    VARCHAR(255)  NOT NULL,
    page_path   VARCHAR(500)  NOT NULL,
    page_label  VARCHAR(255)  NOT NULL,
    sort_order  INT           NOT NULL DEFAULT 0,
    created_at  TIMESTAMP     NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_page_favorite UNIQUE (username, page_path)
);

CREATE INDEX IF NOT EXISTS idx_user_page_fav_username ON user_page_favorite(username);
