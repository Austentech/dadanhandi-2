-- ============================================================================
-- Migration: 007_admin_panel_tables.sql
-- Description: Creates all database tables required for the admin panel,
--              including admin users, OTP-based authentication, sessions,
--              login audit logs, and a reserved role-permission system.
-- Idempotent:  Yes — uses CREATE TABLE IF NOT EXISTS and DO $$ guards
-- Author:      Generated for Dadan Handi project
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger function (idempotent creation)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. admin_users — Core admin user table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'admin'
                CHECK (role IN ('super_admin', 'admin', 'viewer')),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_users_email') THEN
    CREATE INDEX idx_admin_users_email ON admin_users (email);
  END IF;
END $$;

-- updated_at trigger for admin_users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'admin_users_updated_at'
  ) THEN
    CREATE TRIGGER admin_users_updated_at
      BEFORE UPDATE ON admin_users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. admin_otps — OTP records for passwordless login
--    Columns are server-side only; never exposed to the client.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_otps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  otp_hash      TEXT        NOT NULL,          -- SHA-256 of the OTP
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts_used INTEGER     NOT NULL DEFAULT 0,
  max_attempts  INTEGER     NOT NULL DEFAULT 5,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_otps_email_expires') THEN
    CREATE INDEX idx_admin_otps_email_expires ON admin_otps (email, expires_at);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. admin_sessions — Active session management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,   -- SHA-256 of the session token
  ip_address    TEXT,
  user_agent    TEXT,
  device_info   TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  is_valid      BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_sessions_token_hash') THEN
    CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions (token_hash);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_sessions_user_id') THEN
    CREATE INDEX idx_admin_sessions_user_id ON admin_sessions (user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_sessions_expires_at') THEN
    CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions (expires_at);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. admin_login_logs — Audit trail for every login attempt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_login_logs (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        REFERENCES admin_users (id) ON DELETE SET NULL,
  email                    TEXT        NOT NULL,
  login_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at                TIMESTAMPTZ,
  session_duration_seconds INTEGER,
  status                   TEXT        NOT NULL
                           CHECK (status IN ('success', 'failure', 'expired_otp', 'rate_limited', 'invalid_otp')),
  failure_reason           TEXT,
  ip_address               TEXT,
  user_agent               TEXT,
  device_info              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_login_logs_user_id') THEN
    CREATE INDEX idx_admin_login_logs_user_id ON admin_login_logs (user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_login_logs_email') THEN
    CREATE INDEX idx_admin_login_logs_email ON admin_login_logs (email);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_login_logs_status') THEN
    CREATE INDEX idx_admin_login_logs_status ON admin_login_logs (status);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_login_logs_created_at') THEN
    CREATE INDEX idx_admin_login_logs_created_at ON admin_login_logs (created_at);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. admin_roles — Reserved for future role-based access control
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. admin_permissions — Reserved for future permission definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. admin_role_permissions — Junction table (reserved for future use)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id       UUID REFERENCES admin_roles (id) ON DELETE CASCADE,
  permission_id UUID REFERENCES admin_permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================================
-- Row-Level Security (RLS)
-- ============================================================================
-- Enable RLS on tables that must never be readable/writable by anon users.

ALTER TABLE admin_otps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- admin_otps: only service_role (supabase backend) may read/write.
-- No anon or authenticated user should ever access OTP hashes.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_otps' AND policyname = 'admin_otps_service_role_all'
  ) THEN
    CREATE POLICY admin_otps_service_role_all ON admin_otps
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- admin_sessions: only service_role may manage sessions.
-- Session validity checks happen server-side.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_sessions' AND policyname = 'admin_sessions_service_role_all'
  ) THEN
    CREATE POLICY admin_sessions_service_role_all ON admin_sessions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- Seed: Insert the default super_admin account
-- ============================================================================
DO $$ BEGIN
  INSERT INTO admin_users (email, name, role, is_active)
  VALUES ('admin@dadanhandi.com', 'Super Admin', 'super_admin', true)
  ON CONFLICT (email) DO NOTHING;
END $$;

-- ============================================================================
-- Cleanup: Remove expired OTPs older than 24 hours (run periodically)
-- ============================================================================
-- Consider adding a pg_cron job:
--   SELECT cron.schedule('cleanup_expired_admin_otps', '*/5 * * * *',
--     $$ DELETE FROM admin_otps WHERE expires_at < now() $$);
--   SELECT cron.schedule('invalidate_expired_admin_sessions', '*/10 * * * *',
--     $$ UPDATE admin_sessions SET is_valid = false WHERE expires_at < now() AND is_valid = true $$);

-- ============================================================================
-- End of migration 007
-- ============================================================================
