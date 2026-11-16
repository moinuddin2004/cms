-- M3-08: the patient confirms an upcoming appointment from the app.
-- Null = not confirmed. Safe to run more than once.
BEGIN;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_confirmed_at timestamptz;

COMMIT;
