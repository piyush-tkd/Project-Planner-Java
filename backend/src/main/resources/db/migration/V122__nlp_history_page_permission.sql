-- V122: Add page_permission entries for the NLP Conversation History page
-- introduced in the NLP architecture roadmap (history sidebar + dedicated page).
-- All roles get access: ADMIN and READ_WRITE can fully use it,
-- READ_ONLY can view history but cannot submit new queries.

INSERT INTO page_permission (role, page_key, allowed) VALUES
  ('ADMIN',      'nlp_history', true),
  ('READ_WRITE', 'nlp_history', true),
  ('READ_ONLY',  'nlp_history', true)
ON CONFLICT (role, page_key) DO NOTHING;
