-- M2-13: privacy-safe product analytics events. Safe to run more than once.
BEGIN;

CREATE TABLE IF NOT EXISTS product_events (
  id              bigserial PRIMARY KEY,
  actor_type      varchar(10) NOT NULL,
  actor_id        uuid,
  organization_id uuid,
  name            varchar(60) NOT NULL,
  props           jsonb NOT NULL DEFAULT '{}'::jsonb,
  at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_events_actor_type CHECK (actor_type IN ('staff','patient','anon'))
);
CREATE INDEX IF NOT EXISTS idx_product_events_org_name_at ON product_events (organization_id, name, at);
CREATE INDEX IF NOT EXISTS idx_product_events_name_at ON product_events (name, at);

COMMIT;
