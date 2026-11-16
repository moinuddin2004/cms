-- M3-07: patient push. patient_devices (Expo tokens of a patient ACCOUNT), the
-- "turn is near" threshold on queue policies and the once-per-entry marker on
-- queue entries. Safe to run more than once.
BEGIN;

CREATE TABLE IF NOT EXISTS patient_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL,
  expo_push_token varchar(200) NOT NULL,
  platform        varchar(10) NOT NULL,
  device_label    varchar(80),
  app_version     varchar(20),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_patient_devices_platform CHECK ("platform" IN ('android', 'ios')),
  CONSTRAINT fk_patient_devices_account_id FOREIGN KEY (account_id) REFERENCES patient_accounts (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_devices_token ON patient_devices (expo_push_token);
CREATE INDEX IF NOT EXISTS idx_patient_devices_account_id ON patient_devices (account_id);

-- "Your turn is near" goes out when this many people (or fewer) are ahead.
ALTER TABLE queue_policies ADD COLUMN IF NOT EXISTS patient_turn_near_ahead integer NOT NULL DEFAULT 2;
ALTER TABLE queue_policies DROP CONSTRAINT IF EXISTS chk_queue_policies_6;
ALTER TABLE queue_policies ADD CONSTRAINT chk_queue_policies_6
  CHECK ("patient_turn_near_ahead" BETWEEN 0 AND 20);

-- Set once when the turn-near push was decided for this entry (never twice).
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS turn_near_notified_at timestamptz;

COMMIT;
