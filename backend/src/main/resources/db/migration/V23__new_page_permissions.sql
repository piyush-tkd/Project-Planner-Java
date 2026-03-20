-- New page permission keys for features added after V18
-- team_calendar: Team Calendar heatmap page
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'team_calendar', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'team_calendar', true) ON CONFLICT (role, page_key) DO NOTHING;

-- resource_roi: Resource Actual Rates & ROI page (write access only for READ_WRITE)
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_WRITE', 'resource_roi', true) ON CONFLICT (role, page_key) DO NOTHING;
INSERT INTO page_permission (role, page_key, allowed) VALUES ('READ_ONLY',  'resource_roi', false) ON CONFLICT (role, page_key) DO NOTHING;
