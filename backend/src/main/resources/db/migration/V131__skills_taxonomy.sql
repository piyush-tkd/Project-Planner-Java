CREATE TABLE IF NOT EXISTS skill_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  level_scale VARCHAR(20) NOT NULL DEFAULT 'BEGINNER_TO_EXPERT'
    CHECK (level_scale IN ('BEGINNER_TO_EXPERT','1_TO_5','1_TO_10')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS resource_skills (
  id BIGSERIAL PRIMARY KEY,
  resource_id BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_level INTEGER NOT NULL DEFAULT 1 CHECK (proficiency_level BETWEEN 1 AND 10),
  years_experience NUMERIC(4,1),
  verified BOOLEAN NOT NULL DEFAULT false,
  last_assessed DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resource_id, skill_id)
);

-- Seed default skill categories
INSERT INTO skill_categories (name, description) VALUES
  ('Engineering', 'Software engineering and development skills'),
  ('Data & Analytics', 'Data engineering, science, and analytics skills'),
  ('Product & Design', 'Product management and design skills'),
  ('Project Management', 'Project and program management skills'),
  ('Architecture', 'Solution and enterprise architecture skills')
ON CONFLICT (name) DO NOTHING;

-- Seed some default skills
INSERT INTO skills (category_id, name, level_scale)
SELECT sc.id, s.name, 'BEGINNER_TO_EXPERT'
FROM skill_categories sc
JOIN (VALUES
  ('Engineering', 'Java'),
  ('Engineering', 'Python'),
  ('Engineering', 'TypeScript'),
  ('Engineering', 'React'),
  ('Engineering', 'Spring Boot'),
  ('Engineering', 'SQL'),
  ('Engineering', 'AWS'),
  ('Data & Analytics', 'Power BI'),
  ('Data & Analytics', 'Tableau'),
  ('Data & Analytics', 'Spark'),
  ('Project Management', 'Agile/Scrum'),
  ('Project Management', 'Risk Management'),
  ('Architecture', 'System Design'),
  ('Architecture', 'Cloud Architecture')
) AS s(category, name) ON sc.name = s.category
ON CONFLICT DO NOTHING;
