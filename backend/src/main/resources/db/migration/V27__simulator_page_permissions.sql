-- Granular simulator page permission keys (replacing the shared 'simulators' key)
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'timeline_simulator', true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'timeline_simulator', false) ON CONFLICT (role, page_key) DO NOTHING;

INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'scenario_simulator', true)  ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'scenario_simulator', false) ON CONFLICT (role, page_key) DO NOTHING;
