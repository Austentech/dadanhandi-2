-- ============================================================================
-- Migration: 007_admin_panel_tables.sql
-- Description: Creates all database tables required for the admin panel,
--              including admin users, OTP-based authentication, sessions,
--              login audit logs, and a reserved role-permission system.
-- Idempotent:  Yes — uses CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--              CREATE OR REPLACE FUNCTION, DROP+CREATE for triggers/policies.
-- Supabase SQL Editor compatible (no DO $$ blocks).
-- Author:      Generated for Dadan Handi project
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger function (CREATE OR REPLACE is idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

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

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (email);

-- updated_at trigger for admin_users (drop + create for idempotency)
DROP TRIGGER IF EXISTS admin_users_updated_at ON admin_users;
CREATE TRIGGER admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. admin_otps — OTP records for passwordless login
--    Columns are server-side only; never exposed to the client.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_otps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  otp_hash      TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts_used INTEGER     NOT NULL DEFAULT 0,
  max_attempts  INTEGER     NOT NULL DEFAULT 5,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_otps_email_expires ON admin_otps (email, expires_at);

-- ---------------------------------------------------------------------------
-- 3. admin_sessions — Active session management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,
  ip_address    TEXT,
  user_agent    TEXT,
  device_info   TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  is_valid      BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions (expires_at);

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

CREATE INDEX IF NOT EXISTS idx_admin_login_logs_user_id ON admin_login_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_email ON admin_login_logs (email);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_status ON admin_login_logs (status);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_created_at ON admin_login_logs (created_at);

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
ALTER TABLE admin_otps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- admin_otps: only service_role (supabase backend) may read/write.
DROP POLICY IF EXISTS admin_otps_service_role_all ON admin_otps;
CREATE POLICY admin_otps_service_role_all ON admin_otps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- admin_sessions: only service_role may manage sessions.
DROP POLICY IF EXISTS admin_sessions_service_role_all ON admin_sessions;
CREATE POLICY admin_sessions_service_role_all ON admin_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Seed: Insert the default super_admin account
-- ============================================================================
INSERT INTO admin_users (email, name, role, is_active)
VALUES ('admin@dadanhandi.com', 'Super Admin', 'super_admin', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- End of migration 007
-- ============================================================================
