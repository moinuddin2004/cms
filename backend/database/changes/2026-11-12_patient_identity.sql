-- M2-01: patient identity (mobile patient space). Nine tables, no data.
-- Contract: mobile-app/docs/08-database.md sections 1-3. Safe to run more than once.
BEGIN;

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

COMMIT;
