-- Phase 2.3: Add CLOUD_LLM as the final fallback in the NLP strategy chain.
--
-- Previous chain: ["DETERMINISTIC","LOCAL_LLM","RULE_BASED"]
--   (LOCAL_LLM was incorrectly ordered before RULE_BASED)
-- New chain:      ["DETERMINISTIC","RULE_BASED","LOCAL_LLM","CLOUD_LLM"]
--   - CLOUD_LLM is skipped automatically when no API key is configured
--     (CloudLlmStrategy.isAvailable() returns false when api_key is blank)
--   - No operator action needed; set cloud_api_key in NLP Settings to activate it.

UPDATE nlp_config
SET    config_value = '["DETERMINISTIC","RULE_BASED","LOCAL_LLM","CLOUD_LLM"]',
       updated_at   = NOW()
WHERE  config_key   = 'strategy_chain';
