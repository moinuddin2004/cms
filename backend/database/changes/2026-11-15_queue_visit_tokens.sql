-- M3-05: public visit-page tokens (GET /visit/:token/state). Only the sha256 of
-- the token is stored. Safe to run more than once.
BEGIN;

CREATE TABLE IF NOT EXISTS queue_visit_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entry_id        uuid NOT NULL,
  token_hash      char(64) NOT NULL,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_queue_visit_tokens_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_queue_visit_tokens_entry_id FOREIGN KEY (entry_id) REFERENCES queue_entries (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_visit_tokens_token_hash ON queue_visit_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_queue_visit_tokens_entry_id ON queue_visit_tokens (entry_id);
CREATE INDEX IF NOT EXISTS idx_queue_visit_tokens_expires_at ON queue_visit_tokens (expires_at);

COMMIT;
