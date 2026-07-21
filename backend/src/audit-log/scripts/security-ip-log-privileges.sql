-- Security IP Log DB Privilege Setup
-- Run this manually after the app creates the security_ip_log table
-- (TypeORM synchronize: true will create it on first boot).
--
-- Design intent:
--   The application DB user requires INSERT to write raw IPs and
--   DELETE to allow the purge cron job to remove expired rows.
--   SELECT is restricted to a dedicated read role to prevent the
--   app from inadvertently returning raw IPs in API responses.

-- 1. Create the security-IP reader role (for forensic / SIEM queries only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'security_ip_reader') THEN
    CREATE ROLE security_ip_reader;
  END IF;
END
$$;

-- 2. Grant INSERT + DELETE to the app user so it can write and purge rows.
--    Replace 'app_user' with the actual application database user.
GRANT INSERT, DELETE ON security_ip_log TO app_user;

-- 3. Grant SELECT ONLY to the dedicated reader role (never to app_user).
GRANT SELECT ON security_ip_log TO security_ip_reader;

-- 4. Ensure the app user cannot SELECT or UPDATE raw IPs directly.
REVOKE SELECT, UPDATE ON security_ip_log FROM app_user;

-- 5. Document the retention window expectation.
-- The application enforces a soft expiry via the expires_at column and the
-- AuditLogPurgeService cron job.  For a hard database-level guarantee you can
-- add a row-level security policy or a Postgres background job that mirrors
-- the application logic:
--
-- CREATE OR REPLACE FUNCTION purge_expired_security_ip_logs()
-- RETURNS void LANGUAGE sql AS $$
--   DELETE FROM security_ip_log WHERE expires_at < NOW();
-- $$;
