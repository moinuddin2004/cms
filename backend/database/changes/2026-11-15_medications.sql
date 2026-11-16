-- M3-01/M3-02: patient medication schedules + dose events. Safe to run more than once.
BEGIN;

CREATE TABLE IF NOT EXISTS medication_schedules (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id               uuid NOT NULL,
  source                   varchar(15) NOT NULL,
  organization_id          uuid,
  prescription_id          uuid,
  prescription_medicine_id uuid,
  name                     varchar(200) NOT NULL,
  name_urdu                varchar(200),
  dose_text                varchar(120) NOT NULL,
  times                    jsonb NOT NULL DEFAULT '[]',
  meal_relation            varchar(20) NOT NULL DEFAULT 'NONE',
  start_date               date NOT NULL,
  end_date                 date,
  end_date_source          varchar(10) NOT NULL DEFAULT 'unknown',
  status                   varchar(10) NOT NULL DEFAULT 'active',
  instructions             text,
  instructions_urdu        text,
  patient_edited           boolean NOT NULL DEFAULT false,
  prescription_version     int,                              -- prescriptions.version the schedule was last synced from (sweep marker)
  hidden                   boolean NOT NULL DEFAULT false,   -- clinic revoked the link (A-23): not listed, not editable
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_medication_schedules_profile_id FOREIGN KEY (profile_id) REFERENCES patient_profiles (id) ON DELETE CASCADE,
  CONSTRAINT chk_medication_schedules_source CHECK (source IN ('prescription','manual')),
  CONSTRAINT chk_medication_schedules_status CHECK (status IN ('active','paused','completed','stopped')),
  CONSTRAINT chk_medication_schedules_end_source CHECK (end_date_source IN ('parsed','patient','unknown'))
);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_profile_status ON medication_schedules (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_profile_updated ON medication_schedules (profile_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_prescription ON medication_schedules (prescription_id) WHERE prescription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_medication_schedules_profile_rx_medicine ON medication_schedules (profile_id, prescription_medicine_id) WHERE prescription_medicine_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS medication_dose_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL,
  due_at      timestamptz NOT NULL,
  action      varchar(10) NOT NULL,
  acted_at    timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_medication_dose_events_schedule_id FOREIGN KEY (schedule_id) REFERENCES medication_schedules (id) ON DELETE CASCADE,
  CONSTRAINT chk_medication_dose_events_action CHECK (action IN ('taken','skipped'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_medication_dose_events_schedule_due ON medication_dose_events (schedule_id, due_at);

-- Safe on a database that already ran the first version of this script.
ALTER TABLE medication_schedules ADD COLUMN IF NOT EXISTS prescription_version int;
ALTER TABLE medication_schedules ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

COMMIT;
