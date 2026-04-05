-- V91: Resource skill tags with proficiency levels
CREATE TABLE IF NOT EXISTS resource_skill (
    id               BIGSERIAL PRIMARY KEY,
    resource_id      BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
    skill_name       VARCHAR(100) NOT NULL,
    -- 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert
    proficiency      SMALLINT NOT NULL DEFAULT 2 CHECK (proficiency BETWEEN 1 AND 4),
    years_experience DECIMAL(4,1),
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_resource_skill UNIQUE (resource_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_rs_resource  ON resource_skill(resource_id);
CREATE INDEX IF NOT EXISTS idx_rs_skill     ON resource_skill(skill_name);
