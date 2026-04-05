-- V69: Add page permissions for v10.0 Wrike-inspired feature pages
-- Pages: Resource Bookings, Project Templates, Workload Chart, Gantt & Dependencies

INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'resource_bookings', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'resource_bookings', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'project_templates', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'project_templates', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'workload_chart',    true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'workload_chart',    true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'gantt_dependencies', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'gantt_dependencies', true) ON CONFLICT DO NOTHING;

SELECT setval('page_permission_id_seq', (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
