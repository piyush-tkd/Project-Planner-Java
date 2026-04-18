-- Reference data: PODs, effort patterns, tshirt sizes, role mix, timeline config

-- PODs with complexity multipliers (explicit IDs to match seed data expectations)
INSERT INTO pod (id, name, complexity_multiplier, display_order) VALUES (120, 'Portal V1', 1.0, 1);
INSERT INTO pod (id, name, complexity_multiplier, display_order) VALUES (121, 'Portal V2', 1.0, 2);
INSERT INTO pod (id, name, complexity_multiplier, display_order) VALUES (122, 'Integrations', 1.4, 3);
INSERT INTO pod (id, name, complexity_multiplier, display_order) VALUES (123, 'Accessioning', 1.2, 4);
INSERT INTO pod (id, name, complexity_multiplier, display_order) VALUES (124, 'Epic', 1.1, 5);
INSERT INTO pod (id, name, complexity_multiplier, display_order) VALUES (125, 'LIS/Reporting', 1.15, 6);
INSERT INTO pod (id, name, complexity_multiplier, display_order) VALUES (126, 'Enterprise Systems', 1.05, 7);
SELECT setval('pod_id_seq', 126, true);

-- Role effort mix
INSERT INTO role_effort_mix (role, mix_pct) VALUES ('DEVELOPER', 60.0);
INSERT INTO role_effort_mix (role, mix_pct) VALUES ('QA', 20.0);
INSERT INTO role_effort_mix (role, mix_pct) VALUES ('BSA', 10.0);
INSERT INTO role_effort_mix (role, mix_pct) VALUES ('TECH_LEAD', 10.0);

-- Effort patterns (weights for M1-M12)
INSERT INTO effort_pattern (name, description, weights) VALUES ('Flat', 'All effort spread evenly', '{"M1":1,"M2":1,"M3":1,"M4":1,"M5":1,"M6":1,"M7":1,"M8":1,"M9":1,"M10":1,"M11":1,"M12":1}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Ramp Up', 'Team grows into it', '{"M1":0.5,"M2":0.7,"M3":0.9,"M4":1.1,"M5":1.2,"M6":1.2,"M7":1,"M8":1,"M9":1,"M10":1,"M11":1,"M12":1}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Ramp Down', 'Heavy upfront, winds down', '{"M1":1.2,"M2":1.2,"M3":1.1,"M4":0.9,"M5":0.7,"M6":0.5,"M7":1,"M8":1,"M9":1,"M10":1,"M11":1,"M12":1}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Up/Down', 'Peaks in middle', '{"M1":0.7,"M2":0.9,"M3":1.1,"M4":1.2,"M5":1.1,"M6":0.9,"M7":0.7,"M8":0.5,"M9":1,"M10":1,"M11":1,"M12":1}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('QA Late Peak', 'Testing heavy in final months', '{"M1":0.4,"M2":0.6,"M3":0.8,"M4":1,"M5":1.2,"M6":1.4,"M7":1.2,"M8":1,"M9":0.8,"M10":0.6,"M11":0.4,"M12":0.4}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Dev Ramp', 'Dev effort builds then plateaus', '{"M1":0.6,"M2":0.8,"M3":1,"M4":1.1,"M5":1.2,"M6":1.2,"M7":1,"M8":1,"M9":1,"M10":1,"M11":1,"M12":1}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('BSA Early', 'Analysis front-loaded', '{"M1":1.6,"M2":1.4,"M3":1.2,"M4":1,"M5":0.8,"M6":0.6,"M7":0.4,"M8":0.4,"M9":0.4,"M10":0.4,"M11":0.4,"M12":0.4}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Tech Lead Light', 'TL effort distributed but lighter', '{"M1":1.2,"M2":1.1,"M3":1,"M4":0.9,"M5":0.8,"M6":0.8,"M7":0.8,"M8":0.8,"M9":0.8,"M10":0.8,"M11":0.8,"M12":0.8}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Middle Spike', 'Burst in months 3-4 only', '{"M1":0.1,"M2":0.2,"M3":0.3,"M4":0.3,"M5":0.1,"M6":0.1,"M7":0.1,"M8":0.1,"M9":0,"M10":0,"M11":0,"M12":0}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Spike + Stabilize', 'Heavy start tapering off', '{"M1":0.3,"M2":0.25,"M3":0.15,"M4":0.1,"M5":0.1,"M6":0.1,"M7":0,"M8":0.1,"M9":0,"M10":0,"M11":0,"M12":0}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('End Spike', 'Light start, heavy finish', '{"M1":0.05,"M2":0.1,"M3":0.15,"M4":0.2,"M5":0.25,"M6":0.25,"M7":0,"M8":0,"M9":0,"M10":0,"M11":0,"M12":0}');
INSERT INTO effort_pattern (name, description, weights) VALUES ('Short 3m Up/Down', 'Quick wave for 3-month sprints', '{"M1":0.6,"M2":1.2,"M3":0.6,"M4":1,"M5":1,"M6":1,"M7":1,"M8":1,"M9":1,"M10":1,"M11":1,"M12":1}');

-- Timeline config (FY26/27: Mar 2026 - Feb 2027)
INSERT INTO timeline_config (start_year, start_month, current_month_index, working_hours) VALUES (
    2026, 3, 2,
    '{"M1":176,"M2":176,"M3":168,"M4":176,"M5":184,"M6":168,"M7":176,"M8":176,"M9":168,"M10":184,"M11":168,"M12":160}'
);
