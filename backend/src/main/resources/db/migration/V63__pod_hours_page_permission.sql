-- Page permission for the new POD Work Hours report page
INSERT INTO page_permission (role, page_key, allowed)
VALUES ('READ_WRITE', 'pod_hours', true),
       ('READ_ONLY',  'pod_hours', true)
ON CONFLICT (role, page_key) DO NOTHING;
