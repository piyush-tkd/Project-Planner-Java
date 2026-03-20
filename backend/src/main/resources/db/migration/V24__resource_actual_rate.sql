-- Add individual actual hourly rate override per resource
ALTER TABLE resource ADD COLUMN actual_rate NUMERIC(10, 2);
