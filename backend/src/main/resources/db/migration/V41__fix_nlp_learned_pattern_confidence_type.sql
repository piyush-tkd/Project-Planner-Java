-- Fix confidence column type: change from DECIMAL(3,2) to DOUBLE PRECISION
-- to match the JPA entity (Double) and avoid Hibernate schema validation error.
ALTER TABLE nlp_learned_pattern
    ALTER COLUMN confidence TYPE DOUBLE PRECISION USING confidence::DOUBLE PRECISION;
