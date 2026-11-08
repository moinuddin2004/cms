-- Prescription numbers (RX-2026-00001) restart per clinic, but the column
-- was unique across ALL clinics: the second clinic's first prescription
-- failed with a duplicate key. Make it unique per clinic instead.
BEGIN;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS uq_prescriptions_prescription_number;
DROP INDEX IF EXISTS idx_prescriptions_prescription_number;
ALTER TABLE prescriptions
  ADD CONSTRAINT uq_prescriptions_organization_id_prescription_number
  UNIQUE (organization_id, prescription_number);
COMMIT;
