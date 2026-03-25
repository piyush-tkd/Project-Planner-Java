-- Add page permission for Resource Performance report
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'resource_performance', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'resource_performance', true) ON CONFLICT (role, page_key) DO NOTHING;
