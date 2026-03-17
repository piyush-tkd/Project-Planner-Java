-- Fix admin password hash to correctly match "admin"
-- BCrypt hash of "admin" with strength 10 (2a prefix, Spring-compatible)
UPDATE app_user
SET password = '$2a$10$/420kSA4neTTyR2LyTC.9uLD8VZChgyUqjGxANGuXTimRYIqSLuP2'
WHERE username = 'admin';
