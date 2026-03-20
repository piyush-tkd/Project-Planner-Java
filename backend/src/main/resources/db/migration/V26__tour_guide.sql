-- Tour guide configuration (single-row admin settings)
CREATE TABLE tour_config (
    id           BIGSERIAL PRIMARY KEY,
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    -- 'first_login' | 'every_login' | 'every_n' | 'disabled'
    frequency    VARCHAR(20)  NOT NULL DEFAULT 'first_login',
    every_n      INT          NOT NULL DEFAULT 30,  -- days, used when frequency = 'every_n'
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO tour_config (enabled, frequency, every_n) VALUES (true, 'first_login', 30);

-- Per-user tour state
CREATE TABLE user_tour_state (
    id           BIGSERIAL PRIMARY KEY,
    username     VARCHAR(100) NOT NULL UNIQUE,
    seen_count   INT          NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMP
);
