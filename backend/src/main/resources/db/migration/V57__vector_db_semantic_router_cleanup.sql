-- Phase 1.7: Refactor vector DB to semantic router
-- Deactivate QUERY_PATTERN entries with DATA_QUERY/INSIGHT/REPORT intents
-- that were stored with full response data (stale cache problem)
-- These will be re-created as routing decisions only

UPDATE nlp_embedding
SET active = false,
    updated_at = now()
WHERE entity_type = 'QUERY_PATTERN'
  AND intent IN ('DATA_QUERY', 'INSIGHT', 'REPORT')
  AND source IN ('CATALOG', 'PATTERN_SYNC', 'LOG_MINING')
  AND active = true;

-- Add comment explaining the new purpose
COMMENT ON TABLE nlp_embedding IS 'Vector store for semantic routing. QUERY_PATTERN entries store routing decisions (tool + params), not cached responses. Entity entries (RESOURCE, PROJECT, etc.) store entity descriptions for semantic search.';
