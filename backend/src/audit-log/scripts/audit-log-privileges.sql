-- Audit Log DB Privilege Setup
-- Run this manually after the app creates the audit_log table (via synchronize: true).
-- This grants the application DB user INSERT-only access to audit_log,
-- satisfying the SOC 2 CC7.2 append-only requirement.

-- 1. Create the append-only role (if it does not already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_appender') THEN
    CREATE ROLE audit_appender;
  END IF;
END
$$;

-- 2. Grant INSERT on audit_log to the appender role
GRANT INSERT ON audit_log TO audit_appender;

-- 3. Ensure the app DB user can write via the appender role
-- Replace 'app_user' with the actual application database user
GRANT audit_appender TO app_user;

-- 4. Deny any accidental UPDATE/DELETE/TRUNCATE on audit_log from the app user
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_user;
