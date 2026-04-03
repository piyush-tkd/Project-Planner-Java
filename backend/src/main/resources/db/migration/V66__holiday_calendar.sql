-- V66: Holiday Calendar
-- Stores public holidays per location (US / INDIA) per year.
-- Used by capacity planning to reduce available working hours.

CREATE TABLE IF NOT EXISTS holiday_calendar (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    holiday_date DATE        NOT NULL,
    location    VARCHAR(20)  NOT NULL CHECK (location IN ('US', 'INDIA', 'ALL')),
    year        INT          NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR FROM holiday_date)::INT) STORED,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_holiday_location_date UNIQUE (location, holiday_date)
);

CREATE INDEX idx_holiday_year_location ON holiday_calendar(year, location);

-- Page permission
INSERT INTO page_permission (role, page_key, allowed) VALUES
    ('READ_WRITE', 'holiday_calendar', true),
    ('READ_ONLY',  'holiday_calendar', true)
ON CONFLICT (role, page_key) DO NOTHING;

-- ── US Holidays 2026 (Baylor Genetics list) ───────────────────────────────────
INSERT INTO holiday_calendar (name, holiday_date, location) VALUES
    ('New Year''s Day',          '2026-01-01', 'US'),
    ('MLK Jr Day',               '2026-01-19', 'US'),
    ('Memorial Day',             '2026-05-25', 'US'),
    ('Independence Day',         '2026-07-03', 'US'),   -- observed (Jul 4 falls on Sat)
    ('Labor Day',                '2026-09-07', 'US'),
    ('Thanksgiving',             '2026-11-26', 'US'),
    ('Day after Thanksgiving',   '2026-11-27', 'US'),
    ('Christmas Eve',            '2026-12-24', 'US'),
    ('Christmas Day',            '2026-12-25', 'US')
ON CONFLICT (location, holiday_date) DO NOTHING;

-- ── India Holidays 2026 (NonStop io — mandatory, weekdays only) ───────────────
INSERT INTO holiday_calendar (name, holiday_date, location) VALUES
    ('New Year''s Day',          '2026-01-01', 'INDIA'),
    ('Republic Day',             '2026-01-26', 'INDIA'),
    ('Gudhipadwa',               '2026-03-19', 'INDIA'),
    ('Maharashtra Din',          '2026-05-01', 'INDIA'),
    ('Shree Ganesh Chaturthi',   '2026-09-14', 'INDIA'),
    ('Anant Chatrudashi',        '2026-09-25', 'INDIA'),
    ('Gandhi Jayanti',           '2026-10-02', 'INDIA'),
    ('Dasara / Vijaya Dashami',  '2026-10-20', 'INDIA'),
    ('Diwali - Padwa',           '2026-11-10', 'INDIA'),
    ('Christmas Day',            '2026-12-25', 'INDIA')
ON CONFLICT (location, holiday_date) DO NOTHING;
