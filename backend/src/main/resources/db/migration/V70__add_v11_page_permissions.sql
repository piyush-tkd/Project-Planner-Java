-- V70: Add page permissions for v11.0 new pages
-- New pages: Inbox, Objectives, Risk Register, Ideas Board,
--            Capacity Hub, Leave Hub, Calendar Hub, Org Settings

-- ── Inbox ────────────────────────────────────────────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'inbox', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'inbox', true) ON CONFLICT DO NOTHING;

-- ── Objectives ───────────────────────────────────────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'objectives', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'objectives', true) ON CONFLICT DO NOTHING;

-- ── Risk & Issues Register ───────────────────────────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'risk_register', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'risk_register', true) ON CONFLICT DO NOTHING;

-- ── Ideas Board ──────────────────────────────────────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'ideas_board', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'ideas_board', true) ON CONFLICT DO NOTHING;

-- ── Capacity Hub (merged capacity view) ─────────────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'capacity_hub', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'capacity_hub', true) ON CONFLICT DO NOTHING;

-- ── Leave & Holidays Hub ─────────────────────────────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'leave_hub', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'leave_hub', true) ON CONFLICT DO NOTHING;

-- ── Strategic Calendar Hub ───────────────────────────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'calendar_hub', true) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'calendar_hub', true) ON CONFLICT DO NOTHING;

-- ── Org Settings (admin-accessible by default) ───────────────────────────────
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'org_settings', false) ON CONFLICT DO NOTHING;
INSERT INTO public.page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'org_settings', false) ON CONFLICT DO NOTHING;

SELECT setval('page_permission_id_seq', (SELECT COALESCE(MAX(id), 1) FROM page_permission), true);
