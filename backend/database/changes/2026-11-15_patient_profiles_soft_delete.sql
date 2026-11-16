-- M2-10 rework (A-22): patient profiles are soft-deleted so the clinic's link
-- history (patient_record_links: status revoked, revoked_by, reason) survives a
-- removed family member or a deleted account. Name / dob / gender are stripped
-- by the app when it sets deleted_at. Safe to run more than once.
BEGIN;

ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMIT;
