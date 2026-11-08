-- Desktop (Tauri) Google sign-in: the system browser verifies the Google ID
-- token and mints a one-time code, the app redeems it for a session. The code
-- is stored hashed and is single-use (see src/auth/entities/DesktopAuthHandoff.ts).
BEGIN;
CREATE TABLE IF NOT EXISTS desktop_auth_handoffs (
  uuid        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL,
  code_hash   varchar(64) NOT NULL,
  state       varchar(128) NOT NULL,
  auth_domain varchar(255),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_desktop_auth_handoffs_user_id
    FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_desktop_auth_handoffs_code_hash
  ON desktop_auth_handoffs (code_hash);
CREATE INDEX IF NOT EXISTS idx_desktop_auth_handoffs_expires_at
  ON desktop_auth_handoffs (expires_at);
COMMIT;
