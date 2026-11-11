# 08 — Database changes

> Rules: `backend/database/README.md` and root `CLAUDE.md`. Summary: no migrations, no `synchronize`.
> Every change = **entity + block in `schema/02_tables.sql` (or 04/05) + `changes/YYYY-MM-DD_<slug>.sql`**
> in the **same commit**. Change files are idempotent (`IF NOT EXISTS`), wrapped in `BEGIN; … COMMIT;`.
> Constraint names: `pk_`, `fk_<table>_<column>`, `uq_`, `idx_`, `chk_`. Tenant column is
> `organization_id` (never `tenant_id`). UUID PKs `gen_random_uuid()`. Instants `timestamptz`.
> Do **not** use or alter `patients.user_id` (legacy, unused).

## 1. Identity (M2-01) — `changes/<date>_patient_accounts.sql`

```sql
CREATE TABLE IF NOT EXISTS patient_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        varchar(150),
  email            varchar(254) NOT NULL,
  email_verified_at timestamptz,
  phone            varchar(20),
  phone_verified_at timestamptz,
  status           varchar(20) NOT NULL DEFAULT 'active',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_patient_accounts_status CHECK (status IN ('active','disabled','deleted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_accounts_email ON patient_accounts (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_accounts_phone ON patient_accounts (phone);

CREATE TABLE IF NOT EXISTS patient_account_identities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL,
  provider    varchar(20) NOT NULL,             -- google | apple | email
  subject     varchar(255) NOT NULL,            -- google sub / apple sub / lower(email)
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_account_identities_account_id FOREIGN KEY (account_id) REFERENCES patient_accounts (id) ON DELETE CASCADE,
  CONSTRAINT chk_patient_account_identities_provider CHECK (provider IN ('google','apple','email'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_account_identities_provider_subject ON patient_account_identities (provider, subject);

CREATE TABLE IF NOT EXISTS patient_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         uuid NOT NULL,
  refresh_token_hash char(64) NOT NULL,          -- sha256 hex of the current token
  previous_token_hash char(64),                  -- last rotated token: reuse → revoke session
  device_label       varchar(80),
  ip                 varchar(64),
  expires_at         timestamptz NOT NULL,        -- 60 days sliding
  last_used_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_sessions_account_id FOREIGN KEY (account_id) REFERENCES patient_accounts (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_patient_sessions_account_id ON patient_sessions (account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_sessions_refresh_token_hash ON patient_sessions (refresh_token_hash);

CREATE TABLE IF NOT EXISTS patient_login_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       varchar(254) NOT NULL,             -- lower-cased
  code_hash   char(64) NOT NULL,                 -- sha256(code + pepper)
  attempts    smallint NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,              -- 10 min
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_login_codes_email ON patient_login_codes (email, created_at DESC);
```

## 2. Profiles, links, claims (M2-01)

```sql
CREATE TABLE IF NOT EXISTS patient_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL,
  relation    varchar(10) NOT NULL,
  full_name   varchar(150) NOT NULL,
  dob         date,
  gender      varchar(10),
  private_reminders boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_profiles_account_id FOREIGN KEY (account_id) REFERENCES patient_accounts (id) ON DELETE CASCADE,
  CONSTRAINT chk_patient_profiles_relation CHECK (relation IN ('self','child','parent','spouse','other')),
  CONSTRAINT chk_patient_profiles_gender CHECK (gender IS NULL OR gender IN ('male','female','other'))
);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_account_id ON patient_profiles (account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_profiles_self ON patient_profiles (account_id) WHERE relation = 'self';

CREATE TABLE IF NOT EXISTS patient_record_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid NOT NULL,
  organization_id     uuid NOT NULL,
  patient_id          uuid NOT NULL,
  status              varchar(10) NOT NULL DEFAULT 'active',
  link_method         varchar(20) NOT NULL DEFAULT 'staff_qr',
  verified_by_user_id uuid,
  verified_at         timestamptz,
  revoked_at          timestamptz,
  revoked_by_type     varchar(10),              -- patient | clinic | system
  revoked_by_id       uuid,
  revoke_reason       varchar(200),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_record_links_profile_id FOREIGN KEY (profile_id) REFERENCES patient_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_record_links_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_record_links_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT chk_patient_record_links_status CHECK (status IN ('active','frozen','revoked')),
  CONSTRAINT chk_patient_record_links_method CHECK (link_method IN ('staff_qr'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_record_links_active_patient ON patient_record_links (patient_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_patient_record_links_profile_id ON patient_record_links (profile_id);
CREATE INDEX IF NOT EXISTS idx_patient_record_links_org_patient ON patient_record_links (organization_id, patient_id);

CREATE TABLE IF NOT EXISTS patient_claim_tokens (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL,
  patient_id         uuid NOT NULL,
  token_hash         char(64) NOT NULL,
  created_by_user_id uuid NOT NULL,
  expires_at         timestamptz NOT NULL,
  used_at            timestamptz,
  used_by_account_id uuid,
  invalidated_at     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_claim_tokens_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_claim_tokens_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_claim_tokens_token_hash ON patient_claim_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_patient_claim_tokens_org_patient ON patient_claim_tokens (organization_id, patient_id);
```

## 3. Consents and access log (M2-01)

```sql
CREATE TABLE IF NOT EXISTS patient_account_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL,
  kind            varchar(20) NOT NULL,   -- terms | privacy | link | whatsapp_opt_in
  version         varchar(20) NOT NULL,
  organization_id uuid,                   -- for kind = link
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip              varchar(64),
  CONSTRAINT fk_patient_account_consents_account_id FOREIGN KEY (account_id) REFERENCES patient_accounts (id) ON DELETE CASCADE,
  CONSTRAINT chk_patient_account_consents_kind CHECK (kind IN ('terms','privacy','link','whatsapp_opt_in'))
);
CREATE INDEX IF NOT EXISTS idx_patient_account_consents_account_kind ON patient_account_consents (account_id, kind);

CREATE TABLE IF NOT EXISTS patient_access_log (
  id              bigserial PRIMARY KEY,
  account_id      uuid NOT NULL,           -- no FK: survives account deletion
  profile_id      uuid,
  organization_id uuid NOT NULL,
  patient_id      uuid NOT NULL,
  action          varchar(30) NOT NULL,    -- view_list | view_detail | link | unlink | download
  resource_type   varchar(30) NOT NULL,    -- prescription | visit | invoice | appointment | document | link
  resource_id     uuid,
  at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_access_log_org_patient_at ON patient_access_log (organization_id, patient_id, at);
CREATE INDEX IF NOT EXISTS idx_patient_access_log_account_at ON patient_access_log (account_id, at);
```

## 4. Devices (M1-04 staff, M3-07 patient) — `changes/<date>_push_devices.sql`

```sql
CREATE TABLE IF NOT EXISTS user_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  expo_push_token varchar(200) NOT NULL,
  platform        varchar(10) NOT NULL,
  device_label    varchar(80),
  app_version     varchar(20),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_devices_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE,
  CONSTRAINT chk_user_devices_platform CHECK (platform IN ('android','ios'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_devices_token ON user_devices (expo_push_token);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices (user_id);

-- patient_devices: same shape, account_id → patient_accounts(id) ON DELETE CASCADE,
-- uq_patient_devices_token, idx_patient_devices_account_id.
```

Notification outbox (same change file as M1-04):

```sql
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS chk_notification_outbox_channel;
ALTER TABLE notification_outbox ADD CONSTRAINT chk_notification_outbox_channel
  CHECK ("channel" IN ('in_app','whatsapp','sms','email','push'));
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS chk_notification_outbox_status;
ALTER TABLE notification_outbox ADD CONSTRAINT chk_notification_outbox_status
  CHECK ("status" IN ('queued','held_quiet_hours','sent','delivered','failed','skipped_disabled','skipped_opt_out','skipped_unverified','skipped_no_device'));
```

Check for any other CHECK/enum on channel columns (`notification_rules`, `notification_events.channels`,
prefs) with `grep -n "'in_app'" backend/database/schema/*.sql` and extend them in the same file.

## 5. Medications (M3-01)

```sql
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
  times                    jsonb NOT NULL DEFAULT '[]',   -- ["08:00","20:00"]
  meal_relation            varchar(20) NOT NULL DEFAULT 'NONE',
  start_date               date NOT NULL,
  end_date                 date,
  end_date_source          varchar(10) NOT NULL DEFAULT 'unknown',
  status                   varchar(10) NOT NULL DEFAULT 'active',
  instructions             text,
  instructions_urdu        text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_medication_schedules_profile_id FOREIGN KEY (profile_id) REFERENCES patient_profiles (id) ON DELETE CASCADE,
  CONSTRAINT chk_medication_schedules_source CHECK (source IN ('prescription','manual')),
  CONSTRAINT chk_medication_schedules_status CHECK (status IN ('active','paused','completed','stopped')),
  CONSTRAINT chk_medication_schedules_end_source CHECK (end_date_source IN ('parsed','patient','unknown'))
);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_profile_status ON medication_schedules (profile_id, status);
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
```

No FK from `medication_schedules.organization_id / prescription_*` to clinic tables: the schedule is
the patient's property and must survive a clinic deleting its data (plan §4.4).

## 6. Other (later phases)

| Table / column | Phase | Shape |
| --- | --- | --- |
| `queue_visit_tokens` | M3-05 | `id, organization_id, entry_id → queue_entries, token_hash char(64) unique, expires_at, created_at` |
| `appointments.patient_confirmed_at timestamptz` | M3-08 | nullable |
| `appointment_patient_requests` | P07 requests (pilot phase) | `id, organization_id, appointment_id, kind ('reschedule','cancel'), requested_by_account_id, preferred_times jsonb, note, status ('open','accepted','declined'), resolved_by uuid, resolved_at, created_at` |
| `product_events` | M2-13 | `id bigserial, actor_type ('staff','patient','anon'), actor_id uuid, organization_id uuid, name varchar(60), props jsonb, at timestamptz` + `idx_product_events_org_name_at` |

## 7. Entities

- One entity per table under the owning module (`src/patient-auth/entities`, `src/patient-app/entities`,
  `src/patient-links/entities`, `src/devices/entities`, `src/medications/entities`).
- Register with `TypeOrmModule.forFeature([...])` in the module (`autoLoadEntities: true` in `app.module.ts`).
- Column decorators match SQL exactly (`type: 'timestamptz'` for instants, `type: 'date'` for dates).
- Integration-test harnesses that `synchronize` must include new entities they touch.
