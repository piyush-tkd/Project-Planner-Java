-- V127: Add project_pod_planning entries for key V126 projects so that
-- capacity, matrix, and chart pages have realistic multi-pod data.
-- Also seeds project_pod_planning for the original V3 projects that may
-- not have planning rows yet.
--
-- Each INSERT is wrapped in ON CONFLICT DO NOTHING (project_id, pod_id UNIQUE).
-- PODs available: Portal V1, Portal V2, Integrations, Accessioning, Epic,
--                 LIS/Reporting, Enterprise Systems

-- ── WGS Platform Overhaul → Enterprise Systems + Integrations ────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'XL', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'Whole Genome Sequencing Platform Overhaul'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'Whole Genome Sequencing Platform Overhaul'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── CLIA Compliance Automation → LIS/Reporting + Enterprise Systems ──────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'BSA Early'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'CLIA Compliance Automation Suite'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'CLIA Compliance Automation Suite'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Patient Portal Re-Platform → Portal V1 + Portal V2 ───────────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'XL', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'Portal V2'
WHERE p.name = 'Patient Portal Re-Platform'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Ramp Down'
FROM project p JOIN pod pod ON pod.name = 'Portal V1'
WHERE p.name = 'Patient Portal Re-Platform'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── HL7 FHIR R4 Integration → Integrations + Epic ────────────────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'XL', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'HL7 FHIR R4 Integration — Epic'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Epic'
WHERE p.name = 'HL7 FHIR R4 Integration — Epic'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Variant Interpretation Engine v3 → LIS/Reporting + Accessioning ──────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'XL', 'Middle Spike'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'Variant Interpretation Engine v3'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'Accessioning'
WHERE p.name = 'Variant Interpretation Engine v3'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── LIMS Upgrade → Enterprise Systems + LIS/Reporting + Accessioning ─────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'XL', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'LIMS Upgrade — Starlims to LabVantage'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'LIMS Upgrade — Starlims to LabVantage'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'BSA Early'
FROM project p JOIN pod pod ON pod.name = 'Accessioning'
WHERE p.name = 'LIMS Upgrade — Starlims to LabVantage'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Reference Lab Network Connectivity → Integrations ────────────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'Reference Lab Network Connectivity'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Automated Report QC Pipeline → LIS/Reporting + Portal V2 ─────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'Automated Report QC Pipeline'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'S', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Portal V2'
WHERE p.name = 'Automated Report QC Pipeline'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Genetic Counsellor Scheduling App → Portal V1 + Portal V2 ────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'Portal V1'
WHERE p.name = 'Genetic Counsellor Scheduling App'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Portal V2'
WHERE p.name = 'Genetic Counsellor Scheduling App'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Provider Results Delivery API v2 → Integrations + Epic ───────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'Provider Results Delivery API v2'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'S', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Epic'
WHERE p.name = 'Provider Results Delivery API v2'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Insurance Pre-Auth Automation → Accessioning + Enterprise Systems ─────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'BSA Early'
FROM project p JOIN pod pod ON pod.name = 'Accessioning'
WHERE p.name = 'Insurance Pre-Auth Automation'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'Insurance Pre-Auth Automation'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Biobank Sample Tracking Portal → Accessioning + LIS/Reporting ────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Accessioning'
WHERE p.name = 'Biobank Sample Tracking Portal'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'Biobank Sample Tracking Portal'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Pharmacogenomics Report Redesign → LIS/Reporting + Portal V2 ─────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'Pharmacogenomics Report Redesign'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'S', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Portal V2'
WHERE p.name = 'Pharmacogenomics Report Redesign'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Rare Disease Registry Integration → Integrations + LIS/Reporting ─────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'Rare Disease Registry Integration'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'BSA Early'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'Rare Disease Registry Integration'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Clinical Decision Support — Oncology → Enterprise Systems + LIS/Reporting ─
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'XL', 'Middle Spike'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'Clinical Decision Support — Oncology'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'Clinical Decision Support — Oncology'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Multi-Region Data Residency → Integrations + Enterprise Systems ───────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'Multi-Region Data Residency'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'Multi-Region Data Residency'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Lab Order Digitisation → Accessioning + Integrations ─────────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'L', 'BSA Early'
FROM project p JOIN pod pod ON pod.name = 'Accessioning'
WHERE p.name = 'Lab Order Digitisation — Quest'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'Lab Order Digitisation — Quest'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Genomics Data Lake Phase 2 → Enterprise Systems ──────────────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'XL', 'Ramp Up'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'Genomics Data Lake — Phase 2'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Vendor API Security Hardening → Integrations ────────────────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'S', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Integrations'
WHERE p.name = 'Vendor API Security Hardening'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Salesforce CPQ for Genetic Counselling → Portal V2 + Enterprise Systems ──
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'Portal V2'
WHERE p.name = 'Salesforce CPQ for Genetic Counselling'
ON CONFLICT (project_id, pod_id) DO NOTHING;

INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'BSA Early'
FROM project p JOIN pod pod ON pod.name = 'Enterprise Systems'
WHERE p.name = 'Salesforce CPQ for Genetic Counselling'
ON CONFLICT (project_id, pod_id) DO NOTHING;

-- ── Batch Result Reprocessing Tool → LIS/Reporting ───────────────────────────
INSERT INTO project_pod_planning (project_id, pod_id, tshirt_size, effort_pattern)
SELECT p.id, pod.id, 'M', 'Flat'
FROM project p JOIN pod pod ON pod.name = 'LIS/Reporting'
WHERE p.name = 'Batch Result Reprocessing Tool'
ON CONFLICT (project_id, pod_id) DO NOTHING;
