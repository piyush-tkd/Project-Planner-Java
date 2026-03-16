-- Create tshirt_size_config table so sizes are editable
CREATE TABLE tshirt_size_config (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(10) NOT NULL UNIQUE,
    base_hours  INT NOT NULL,
    display_order INT NOT NULL DEFAULT 0
);

-- Seed with existing enum values
INSERT INTO tshirt_size_config (name, base_hours, display_order) VALUES ('XS', 40, 1);
INSERT INTO tshirt_size_config (name, base_hours, display_order) VALUES ('S', 80, 2);
INSERT INTO tshirt_size_config (name, base_hours, display_order) VALUES ('M', 160, 3);
INSERT INTO tshirt_size_config (name, base_hours, display_order) VALUES ('L', 320, 4);
INSERT INTO tshirt_size_config (name, base_hours, display_order) VALUES ('XL', 600, 5);

-- Remove the CHECK constraint on project_pod_planning.tshirt_size
-- so custom sizes can be used
ALTER TABLE project_pod_planning DROP CONSTRAINT IF EXISTS project_pod_planning_tshirt_size_check;
