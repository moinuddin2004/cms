-- Audit M4: a patient session's phones are deleted when that session is revoked.
-- Safe to run more than once.
BEGIN;
ALTER TABLE patient_devices ADD COLUMN IF NOT EXISTS session_id uuid;
CREATE INDEX IF NOT EXISTS idx_patient_devices_session_id ON patient_devices (session_id);
COMMIT;
