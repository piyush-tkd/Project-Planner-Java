CREATE TABLE cost_rate (
    id              BIGSERIAL PRIMARY KEY,
    role            VARCHAR(50) NOT NULL,
    location        VARCHAR(50) NOT NULL,
    hourly_rate     NUMERIC(10,2) NOT NULL,
    UNIQUE (role, location)
);
