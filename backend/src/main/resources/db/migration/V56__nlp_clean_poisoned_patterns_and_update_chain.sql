-- V55: Clean poisoned auto-learned patterns and update strategy chain
-- Part of the NLP architecture refactor (Phase 0.3 & 0.4)
--
-- Problem: Auto-learn was storing stale DATA_QUERY/INSIGHT/REPORT responses in the vector DB
-- and learned patterns table, causing queries to return empty/stale cached data.
-- Fix: Clean existing poisoned data and update the default strategy chain to DETERMINISTIC first.

-- 1. Deactivate all auto-learned embeddings with data-bearing intents
-- These were storing stale responses that bypassed live data queries
UPDATE nlp_embedding
SET active = false
WHERE source = 'AUTO_LEARN'
  AND entity_type = 'QUERY_PATTERN'
  AND (intent IN ('DATA_QUERY', 'INSIGHT', 'REPORT'));

-- 2. Deactivate all learned patterns with data-bearing intents
-- These were returning skeletal metadata ({_learnedPattern: true, patternId: N}) instead of real data
UPDATE nlp_learned_pattern
SET active = false
WHERE resolved_intent IN ('DATA_QUERY', 'INSIGHT', 'REPORT');

-- 3. Update the strategy chain default to include DETERMINISTIC first
-- The new chain: DETERMINISTIC → LOCAL_LLM → RULE_BASED
INSERT INTO nlp_config (config_key, config_value, updated_at)
VALUES ('strategy_chain', '["DETERMINISTIC","LOCAL_LLM","RULE_BASED"]', NOW())
ON CONFLICT (config_key) DO UPDATE SET config_value = '["DETERMINISTIC","LOCAL_LLM","RULE_BASED"]', updated_at = NOW();
