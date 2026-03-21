-- V39: Increase NLP catalog cache TTL from 5 to 15 minutes
-- to reduce frequency of expensive 15+ query catalog rebuilds.
UPDATE nlp_config SET config_value = '15' WHERE config_key = 'cache_ttl_minutes';

-- Also increase the max timeout from 5s to 30s for heavier catalog builds
UPDATE nlp_config SET config_value = '30000' WHERE config_key = 'max_timeout_ms';
