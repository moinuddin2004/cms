-- All tables, in dependency order: every table is created after the tables
-- its foreign keys point to, so this file runs top to bottom without errors.
-- Each block: enum types it introduces, CREATE TABLE (with its primary key,
-- unique, check and foreign-key constraints), then its indexes.
-- Source of truth for each block is the entity file named in its header —
-- when you change an entity, change its block here too (and add a script
-- under database/changes/ for databases that already exist).
--
-- Tables: 156   Columns: 2193   Foreign keys: 276   Indexes: 306   Enum types: 136

-- ------------------------------------------------------------------------
-- organizations   (src/organizations/entities/organization.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE organizations_subscription_plan_enum AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE organizations_approval_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TABLE organizations (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                varchar(255) NOT NULL,
  slug                varchar(255) NOT NULL,
  email               varchar(255),
  phone               varchar(20),
  website             varchar(500),
  subscription_plan   organizations_subscription_plan_enum NOT NULL DEFAULT 'free',
  clinic_type         varchar(100),
  specialty_tags      jsonb NOT NULL DEFAULT '["general"]',
  timezone            varchar(100) NOT NULL DEFAULT 'Asia/Karachi',
  currency            varchar(10) NOT NULL DEFAULT 'PKR',
  max_locations       integer,
  max_users           integer,
  is_active           boolean NOT NULL DEFAULT true,
  trial_ends_at       timestamptz,
  paid_until          timestamptz,
  onboarding_pending  boolean NOT NULL DEFAULT false,
  approval_status     organizations_approval_status_enum NOT NULL DEFAULT 'approved',
  approval_decided_at timestamptz,
  approval_decided_by uuid,
  approval_note       text,
  access_version      integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organizations_slug UNIQUE (slug)
);
CREATE INDEX idx_organizations_is_active ON organizations (is_active);
CREATE UNIQUE INDEX idx_organizations_slug ON organizations (slug);

-- ------------------------------------------------------------------------
-- locations   (src/locations/entities/location.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE locations (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  uuid NOT NULL,
  name             varchar(255) NOT NULL,
  code             varchar(50) NOT NULL,
  token_prefix     varchar(12),
  address          text,
  city             varchar(100),
  state            varchar(100),
  postal_code      varchar(20),
  country          varchar(100),
  phone            varchar(20),
  email            varchar(255),
  timezone         varchar(100) NOT NULL DEFAULT 'UTC',
  currency         varchar(10) NOT NULL DEFAULT 'USD',
  manager_id       uuid,
  operating_hours  jsonb,
  capacity_per_day integer,
  total_chairs     integer NOT NULL DEFAULT 1,
  business_model   varchar(50),
  is_main_branch   boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid,
  updated_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_locations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_locations_organization_id_code ON locations (organization_id, code);
CREATE INDEX idx_locations_organization_id_is_active ON locations (organization_id, is_active);

-- ------------------------------------------------------------------------
-- patients   (src/patients/entities/patient.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patients_gender_enum AS ENUM ('male', 'female', 'other');
CREATE TYPE patients_blood_group_enum AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
CREATE TYPE patients_marital_status_enum AS ENUM ('single', 'married', 'divorced', 'widowed');
CREATE TYPE patients_preferred_language_enum AS ENUM ('urdu', 'english');
CREATE TYPE patients_communication_pref_enum AS ENUM ('whatsapp', 'sms', 'call', 'email');
CREATE TYPE patients_source_enum AS ENUM ('walk_in', 'referral', 'online', 'social_media', 'google', 'other');
CREATE TABLE patients (
  id                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id            uuid NOT NULL,
  patient_number             varchar(20) NOT NULL,
  full_name                  varchar(150) NOT NULL,
  dob                        date,
  gender                     patients_gender_enum,
  blood_group                patients_blood_group_enum,
  marital_status             patients_marital_status_enum,
  occupation                 varchar(100),
  cnic                       varchar(15),
  phone                      varchar(20) NOT NULL,
  whatsapp_number            varchar(20),
  email                      varchar(150),
  address                    text,
  city                       varchar(100),
  preferred_language         patients_preferred_language_enum NOT NULL DEFAULT 'urdu',
  communication_pref         patients_communication_pref_enum NOT NULL DEFAULT 'whatsapp',
  primary_location_id        uuid,
  source                     patients_source_enum NOT NULL DEFAULT 'walk_in',
  referred_by_text           varchar(200),
  profile_picture_url        text,
  is_minor                   boolean NOT NULL DEFAULT false,
  guardian_name              varchar(150),
  guardian_phone             varchar(20),
  guardian_relation          varchar(50),
  medical_history            text,
  allergies                  text,
  emergency_contact_name     varchar(150),
  emergency_contact_phone    varchar(20),
  emergency_contact_relation varchar(50),
  internal_notes             text,
  tags                       jsonb NOT NULL DEFAULT '[]',
  is_active                  boolean NOT NULL DEFAULT true,
  is_blacklisted             boolean NOT NULL DEFAULT false,
  blacklist_reason           text,
  user_id                    uuid,
  created_by                 uuid,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  deleted_at                 timestamptz,
  CONSTRAINT fk_patients_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patients_primary_location_id FOREIGN KEY (primary_location_id) REFERENCES locations (id) ON DELETE SET NULL
);
CREATE INDEX idx_patients_organization_id_is_blacklisted ON patients (organization_id, is_blacklisted);
CREATE INDEX idx_patients_primary_location_id ON patients (primary_location_id);
CREATE INDEX idx_patients_cnic ON patients (cnic);
CREATE INDEX idx_patients_full_name ON patients (full_name);
CREATE INDEX idx_patients_phone ON patients (phone);
CREATE INDEX idx_patients_organization_id_is_active ON patients (organization_id, is_active);
CREATE UNIQUE INDEX idx_patients_organization_id_patient_number ON patients (organization_id, patient_number);

-- ------------------------------------------------------------------------
-- employees   (src/employees/entities/employee.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE employees_gender_enum AS ENUM ('male', 'female', 'other');
CREATE TABLE employees (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name           varchar(255) NOT NULL,
  phone               varchar(20) NOT NULL,
  cnic                varchar(20),
  gender              employees_gender_enum,
  dob                 date,
  profile_picture_url varchar,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employees_phone UNIQUE (phone),
  CONSTRAINT uq_employees_cnic UNIQUE (cnic)
);
CREATE INDEX idx_employees_cnic ON employees (cnic);
CREATE INDEX idx_employees_phone ON employees (phone);

-- ------------------------------------------------------------------------
-- specialties   (src/engine/entities/specialty.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE specialties (
  id                 uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  code               varchar(30) NOT NULL,
  name               varchar(100) NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  enabled_by_default boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_specialties_code UNIQUE (code)
);

-- ------------------------------------------------------------------------
-- labs   (src/labs/entities/lab.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE labs_lab_type_enum AS ENUM ('external', 'internal');
CREATE TYPE labs_status_enum AS ENUM ('active', 'suspended');
CREATE TABLE labs (
  id                    uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  lab_type              labs_lab_type_enum NOT NULL,
  owner_organization_id uuid,
  name                  varchar(150) NOT NULL,
  phone                 varchar(20),
  whatsapp_phone        varchar(20),
  email                 varchar(255),
  email_verified_at     timestamptz,
  email_verify_token    varchar(64),
  email_verify_expires  timestamptz,
  city                  varchar(100),
  address               text,
  status                labs_status_enum NOT NULL DEFAULT 'active',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_labs_owner CHECK (("lab_type" = 'internal') = ("owner_organization_id" IS NOT NULL)),
  CONSTRAINT fk_labs_owner_organization_id FOREIGN KEY (owner_organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);
CREATE INDEX idx_labs_owner ON labs (owner_organization_id);
CREATE INDEX idx_labs_status_name ON labs (status, name);

-- ------------------------------------------------------------------------
-- workflow_templates   (src/engine/entities/workflow-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE workflow_templates_entity_type_enum AS ENUM ('order', 'item', 'stage');
CREATE TABLE workflow_templates (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  specialty_id    uuid NOT NULL,
  organization_id uuid,
  entity_type     workflow_templates_entity_type_enum NOT NULL,
  code            varchar(50) NOT NULL,
  name            varchar(150) NOT NULL,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_workflow_templates_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT,
  CONSTRAINT fk_workflow_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_workflow_templates_org_code ON workflow_templates (organization_id, specialty_id, code) WHERE "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX uq_workflow_templates_platform_code ON workflow_templates (specialty_id, code) WHERE "organization_id" IS NULL;

-- ------------------------------------------------------------------------
-- workflow_template_versions   (src/engine/entities/workflow-template-version.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE workflow_template_versions_status_enum AS ENUM ('draft', 'published', 'retired');
CREATE TABLE workflow_template_versions (
  id                   uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  workflow_template_id uuid NOT NULL,
  version_no           integer NOT NULL,
  definition_json      jsonb NOT NULL,
  status               workflow_template_versions_status_enum NOT NULL DEFAULT 'draft',
  published_at         timestamptz,
  published_by         uuid,
  retired_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_workflow_template_versions_no UNIQUE (workflow_template_id, version_no),
  CONSTRAINT chk_workflow_template_versions_no CHECK ("version_no" > 0),
  CONSTRAINT fk_workflow_template_versions_workflow_template_id FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_workflow_template_versions_one_published ON workflow_template_versions (workflow_template_id) WHERE "status" = 'published';
CREATE UNIQUE INDEX uq_workflow_template_versions_one_draft ON workflow_template_versions (workflow_template_id) WHERE "status" = 'draft';

-- ------------------------------------------------------------------------
-- lab_clinic_links   (src/labs/entities/lab-clinic-link.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_clinic_links_status_enum AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE lab_clinic_links_patient_data_level_enum AS ENUM ('full_name', 'code_only');
CREATE TABLE lab_clinic_links (
  id                 uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  lab_id             uuid NOT NULL,
  organization_id    uuid NOT NULL,
  status             lab_clinic_links_status_enum NOT NULL DEFAULT 'invited',
  payment_terms_days integer NOT NULL DEFAULT 30,
  patient_data_level lab_clinic_links_patient_data_level_enum NOT NULL DEFAULT 'full_name',
  activated_at       timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_clinic_links_lab_org UNIQUE (lab_id, organization_id),
  CONSTRAINT chk_lab_clinic_links_terms CHECK ("payment_terms_days" BETWEEN 0 AND 365),
  CONSTRAINT fk_lab_clinic_links_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_clinic_links_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_clinic_links_org_status ON lab_clinic_links (organization_id, status);

-- ------------------------------------------------------------------------
-- lab_orders   (src/lab-orders/entities/lab-order.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_orders_priority_enum AS ENUM ('normal', 'urgent');
CREATE TABLE lab_orders (
  id                           uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id              uuid NOT NULL,
  location_id                  uuid NOT NULL,
  order_no                     varchar(30),
  specialty_id                 uuid NOT NULL,
  patient_id                   uuid NOT NULL,
  doctor_id                    uuid,
  lab_id                       uuid NOT NULL,
  lab_clinic_link_id           uuid NOT NULL,
  workflow_template_version_id uuid NOT NULL,
  status_code                  varchar(50) NOT NULL,
  priority                     lab_orders_priority_enum NOT NULL DEFAULT 'normal',
  requested_on                 date,
  lab_expected_on              date,
  appointment_id               uuid,
  treatment_id                 uuid,
  order_template_id            uuid,
  notes                        text,
  current_revision_no          integer NOT NULL DEFAULT 0,
  submitted_at                 timestamptz,
  accepted_at                  timestamptz,
  completed_at                 timestamptz,
  cancelled_at                 timestamptz,
  idempotency_key              varchar(150),
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid,
  updated_by                   uuid,
  version                      integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_orders_org_idempotency UNIQUE (organization_id, idempotency_key),
  CONSTRAINT uq_lab_orders_org_no UNIQUE (organization_id, order_no),
  CONSTRAINT fk_lab_orders_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_orders_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_orders_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_orders_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_orders_doctor_id FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_orders_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_orders_lab_clinic_link_id FOREIGN KEY (lab_clinic_link_id) REFERENCES lab_clinic_links (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_orders_workflow_template_version_id FOREIGN KEY (workflow_template_version_id) REFERENCES workflow_template_versions (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_orders_patient ON lab_orders (patient_id, created_at);
CREATE INDEX idx_lab_orders_lab_queue ON lab_orders (lab_id, status_code, submitted_at);
CREATE INDEX idx_lab_orders_org_status_due ON lab_orders (organization_id, status_code, lab_expected_on);

-- ------------------------------------------------------------------------
-- form_schemas   (src/engine/entities/form-schema.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE form_schemas (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  specialty_id    uuid NOT NULL,
  organization_id uuid,
  code            varchar(50) NOT NULL,
  name            varchar(150) NOT NULL,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_form_schemas_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT,
  CONSTRAINT fk_form_schemas_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_form_schemas_org_code ON form_schemas (organization_id, specialty_id, code) WHERE "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX uq_form_schemas_platform_code ON form_schemas (specialty_id, code) WHERE "organization_id" IS NULL;

-- ------------------------------------------------------------------------
-- stage_templates   (src/engine/entities/stage-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE stage_templates (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  specialty_id    uuid NOT NULL,
  organization_id uuid,
  code            varchar(50) NOT NULL,
  name            varchar(150) NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_stage_templates_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT,
  CONSTRAINT fk_stage_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_stage_templates_org_code ON stage_templates (organization_id, specialty_id, code) WHERE "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX uq_stage_templates_platform_code ON stage_templates (specialty_id, code) WHERE "organization_id" IS NULL;

-- ------------------------------------------------------------------------
-- service_categories   (src/lab-catalog/entities/service-category.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE service_categories (
  id           uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  specialty_id uuid NOT NULL,
  code         varchar(50) NOT NULL,
  name         varchar(100) NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  version      integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_service_categories_code UNIQUE (specialty_id, code),
  CONSTRAINT fk_service_categories_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT
);
CREATE INDEX idx_service_categories_specialty ON service_categories (specialty_id, is_active, sort_order);

-- ------------------------------------------------------------------------
-- lab_services   (src/lab-catalog/entities/lab-service.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_services_unit_type_enum AS ENUM ('per_tooth', 'per_unit', 'per_arch', 'per_case');
CREATE TABLE lab_services (
  id                      uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  lab_id                  uuid NOT NULL,
  specialty_id            uuid NOT NULL,
  category_id             uuid NOT NULL,
  code                    varchar(50) NOT NULL,
  name                    varchar(150) NOT NULL,
  description             text,
  unit_type               lab_services_unit_type_enum NOT NULL,
  default_turnaround_days integer NOT NULL DEFAULT 7,
  form_schema_id          uuid,
  workflow_template_id    uuid,
  stage_template_id       uuid,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid,
  updated_by              uuid,
  version                 integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_services_lab_code UNIQUE (lab_id, code),
  CONSTRAINT chk_lab_services_turnaround CHECK ("default_turnaround_days" BETWEEN 0 AND 365),
  CONSTRAINT fk_lab_services_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_services_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_services_category_id FOREIGN KEY (category_id) REFERENCES service_categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_services_form_schema_id FOREIGN KEY (form_schema_id) REFERENCES form_schemas (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_services_workflow_template_id FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_services_stage_template_id FOREIGN KEY (stage_template_id) REFERENCES stage_templates (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_services_category ON lab_services (category_id);
CREATE INDEX idx_lab_services_lab_active ON lab_services (lab_id, is_active, name);

-- ------------------------------------------------------------------------
-- users   (src/user/entities/user.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE users_provider_enum AS ENUM ('google', 'local');
CREATE TYPE users_global_role_enum AS ENUM ('super_admin');
CREATE TYPE users_status_enum AS ENUM ('active', 'suspended', 'deleted');
CREATE TABLE users (
  uuid                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email                         varchar(255) NOT NULL,
  name                          varchar(255),
  phone                         varchar(20),
  avatar_url                    varchar(500),
  avatar_key                    varchar(500),
  password                      varchar(255),
  password_reset_token          varchar,
  password_reset_expires        timestamptz,
  email_verification_token      varchar(64),
  email_verification_expires    timestamptz,
  email_verified_at             timestamptz,
  email_verification_due_at     timestamptz,
  provider                      users_provider_enum NOT NULL DEFAULT 'local',
  refresh_token                 varchar,
  global_role                   users_global_role_enum,
  status                        users_status_enum NOT NULL DEFAULT 'active',
  last_accessed_organization_id uuid,
  last_accessed_location_id     uuid,
  deleted_at                    timestamptz,
  suspended_at                  timestamptz,
  suspension_reason             text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_email UNIQUE (email)
);
CREATE INDEX idx_users_status ON users (status);

-- ------------------------------------------------------------------------
-- form_schema_versions   (src/engine/entities/form-schema-version.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE form_schema_versions_status_enum AS ENUM ('draft', 'published', 'retired');
CREATE TABLE form_schema_versions (
  id             uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  form_schema_id uuid NOT NULL,
  version_no     integer NOT NULL,
  schema_json    jsonb NOT NULL,
  ui_json        jsonb,
  promotions     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         form_schema_versions_status_enum NOT NULL DEFAULT 'draft',
  published_at   timestamptz,
  published_by   uuid,
  retired_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  version        integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_form_schema_versions_no UNIQUE (form_schema_id, version_no),
  CONSTRAINT chk_form_schema_versions_published_at CHECK (("status" = 'draft') = ("published_at" IS NULL)),
  CONSTRAINT chk_form_schema_versions_no CHECK ("version_no" > 0),
  CONSTRAINT fk_form_schema_versions_form_schema_id FOREIGN KEY (form_schema_id) REFERENCES form_schemas (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_form_schema_versions_one_published ON form_schema_versions (form_schema_id) WHERE "status" = 'published';
CREATE UNIQUE INDEX uq_form_schema_versions_one_draft ON form_schema_versions (form_schema_id) WHERE "status" = 'draft';

-- ------------------------------------------------------------------------
-- lab_order_items   (src/lab-orders/entities/lab-order-item.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_order_items_unit_type_enum AS ENUM ('per_tooth', 'per_unit', 'per_arch', 'per_case');
CREATE TABLE lab_order_items (
  id                           uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id              uuid NOT NULL,
  order_id                     uuid NOT NULL,
  line_no                      integer NOT NULL,
  lab_service_id               uuid NOT NULL,
  clinic_treatment_id          uuid,
  option_ids                   uuid[] NOT NULL DEFAULT '{}',
  rush                         boolean NOT NULL DEFAULT false,
  quantity                     integer NOT NULL DEFAULT 1,
  service_code_snap            varchar(50),
  service_name_snap            varchar(150),
  unit_type                    lab_order_items_unit_type_enum,
  options_snap                 jsonb,
  lab_price_id                 uuid,
  currency                     char(3) NOT NULL DEFAULT 'PKR',
  lab_unit_cost_minor          bigint NOT NULL DEFAULT 0,
  lab_line_cost_minor          bigint NOT NULL DEFAULT 0,
  patient_unit_price_minor     bigint NOT NULL DEFAULT 0,
  patient_line_price_minor     bigint NOT NULL DEFAULT 0,
  priced_on                    date,
  form_schema_version_id       uuid,
  workflow_template_version_id uuid NOT NULL,
  stage_template_id            uuid,
  status_code                  varchar(50),
  current_stage_seq            integer,
  remake_of_item_id            uuid,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid,
  updated_by                   uuid,
  version                      integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_order_items_line UNIQUE (order_id, line_no),
  CONSTRAINT chk_lab_order_items_minor CHECK ("lab_unit_cost_minor" >= 0 AND "lab_line_cost_minor" >= 0 AND "patient_unit_price_minor" >= 0 AND "patient_line_price_minor" >= 0),
  CONSTRAINT chk_lab_order_items_quantity CHECK ("quantity" > 0),
  CONSTRAINT fk_lab_order_items_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_order_items_lab_service_id FOREIGN KEY (lab_service_id) REFERENCES lab_services (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_order_items_form_schema_version_id FOREIGN KEY (form_schema_version_id) REFERENCES form_schema_versions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_order_items_workflow_template_version_id FOREIGN KEY (workflow_template_version_id) REFERENCES workflow_template_versions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_order_items_remake_of_item_id FOREIGN KEY (remake_of_item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_order_items_remake ON lab_order_items (remake_of_item_id);
CREATE INDEX idx_lab_order_items_org_status ON lab_order_items (organization_id, status_code);
CREATE INDEX idx_lab_order_items_order ON lab_order_items (order_id);

-- ------------------------------------------------------------------------
-- appointments   (src/appointments/entities/appointment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE appointments_type_enum AS ENUM ('consultation', 'follow_up', 'treatment', 'checkup', 'emergency', 'cleaning');
CREATE TYPE appointments_status_enum AS ENUM ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');
CREATE TYPE appointments_cancel_reason_code_enum AS ENUM ('no_show', 'patient_left', 'other');
CREATE TABLE appointments (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id    uuid NOT NULL,
  location_id        uuid NOT NULL,
  patient_id         uuid NOT NULL,
  doctor_id          uuid NOT NULL,
  type               appointments_type_enum NOT NULL DEFAULT 'consultation',
  status             appointments_status_enum NOT NULL DEFAULT 'scheduled',
  start_time         timestamptz NOT NULL,
  end_time           timestamptz NOT NULL,
  duration_minutes   integer NOT NULL DEFAULT 30,
  reason_for_visit   text,
  is_emergency       boolean NOT NULL DEFAULT false,
  notes              text,
  cancel_reason_code appointments_cancel_reason_code_enum,
  cancel_reason      text,
  checked_in_at      timestamptz,
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  no_show_at         timestamptz,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_doctor_overlap EXCLUDE USING gist ("doctor_id" WITH =, tstzrange("start_time", "end_time", '[)') WITH &&) WHERE ("status" NOT IN ('cancelled', 'no_show')),
  CONSTRAINT fk_appointments_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_appointments_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_appointments_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_appointments_doctor_id FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE RESTRICT
);
CREATE INDEX idx_appointments_doctor_id_start_time_end_time ON appointments (doctor_id, start_time, end_time);
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_appointments_doctor_id ON appointments (doctor_id);
CREATE INDEX idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX idx_appointments_organization_id ON appointments (organization_id);
CREATE INDEX idx_appointments_location_id_start_time ON appointments (location_id, start_time);

-- ------------------------------------------------------------------------
-- employment_roles   (src/employees/entities/employment-role.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE employment_roles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name            varchar(100) NOT NULL,
  slug            varchar(100) NOT NULL,
  permissions     jsonb NOT NULL DEFAULT '{}',
  description     text,
  template_key    varchar(50),
  home_route      varchar(255),
  is_system_role  boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employment_roles_organization_id_slug UNIQUE (organization_id, slug),
  CONSTRAINT fk_employment_roles_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_employment_roles_organization_id_is_active ON employment_roles (organization_id, is_active);

-- ------------------------------------------------------------------------
-- employee_org_location_assignments   (src/employees/entities/employee-org-location-assignment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE employee_org_location_assignments_employment_type_enum AS ENUM ('full_time', 'part_time', 'visiting', 'contract');
CREATE TABLE employee_org_location_assignments (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id        uuid NOT NULL,
  organization_id    uuid NOT NULL,
  location_id        uuid NOT NULL,
  employment_role_id uuid,
  designation        varchar(100) NOT NULL,
  token_prefix       varchar(6),
  employment_type    employee_org_location_assignments_employment_type_enum NOT NULL DEFAULT 'full_time',
  employee_code      varchar(20) NOT NULL,
  joining_date       date NOT NULL,
  gross_salary       numeric(10,2),
  has_portal_access  boolean NOT NULL DEFAULT false,
  user_id            uuid,
  is_primary         boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_org_location_assignments_organization_id_emp_cdc921 UNIQUE (organization_id, employee_code),
  CONSTRAINT uq_employee_org_location_assignments_employee_id_location_id UNIQUE (employee_id, location_id),
  CONSTRAINT fk_employee_org_location_assignments_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_org_location_assignments_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_org_location_assignments_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_org_location_assignments_employment_role_id FOREIGN KEY (employment_role_id) REFERENCES employment_roles (id) ON DELETE SET NULL,
  CONSTRAINT fk_employee_org_location_assignments_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE SET NULL
);
CREATE INDEX idx_employee_org_location_assignments_employee_id_has_po_04f41c ON employee_org_location_assignments (employee_id, has_portal_access);
CREATE INDEX idx_employee_org_location_assignments_user_id ON employee_org_location_assignments (user_id);
CREATE INDEX idx_employee_org_location_assignments_location_id_is_active ON employee_org_location_assignments (location_id, is_active);
CREATE INDEX idx_employee_org_location_assignments_employee_id_organi_0b058a ON employee_org_location_assignments (employee_id, organization_id);

-- ------------------------------------------------------------------------
-- lab_invoices   (src/lab-billing/entities/lab-invoice.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_invoices_status_enum AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'void');
CREATE TABLE lab_invoices (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  invoice_no      varchar(30),
  patient_id      uuid NOT NULL,
  order_id        uuid,
  status          lab_invoices_status_enum NOT NULL DEFAULT 'draft',
  issued_on       date,
  due_on          date,
  currency        char(3) NOT NULL DEFAULT 'PKR',
  subtotal_minor  bigint NOT NULL DEFAULT 0,
  discount_minor  bigint NOT NULL DEFAULT 0,
  tax_minor       bigint NOT NULL DEFAULT 0,
  total_minor     bigint NOT NULL DEFAULT 0,
  credited_minor  bigint NOT NULL DEFAULT 0,
  paid_minor      bigint NOT NULL DEFAULT 0,
  balance_minor   bigint NOT NULL DEFAULT 0,
  notes           text,
  issued_by       uuid,
  issued_at       timestamptz,
  void_reason     text,
  voided_by       uuid,
  voided_at       timestamptz,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_invoices_org_no UNIQUE (organization_id, invoice_no),
  CONSTRAINT chk_lab_invoices_math CHECK ("total_minor" = "subtotal_minor" - "discount_minor" + "tax_minor" AND "balance_minor" >= 0 AND "paid_minor" >= 0 AND "credited_minor" >= 0),
  CONSTRAINT fk_lab_invoices_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_invoices_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_invoices_status ON lab_invoices (organization_id, status);
CREATE INDEX idx_lab_invoices_order ON lab_invoices (order_id);
CREATE INDEX idx_lab_invoices_patient ON lab_invoices (organization_id, patient_id);

-- ------------------------------------------------------------------------
-- queue_sessions   (src/queue/entities/queue-session.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE queue_sessions_status_enum AS ENUM ('waiting_for_doctor', 'open', 'paused', 'closed');
CREATE TABLE queue_sessions (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     uuid NOT NULL,
  location_id         uuid NOT NULL,
  doctor_id           uuid NOT NULL,
  service_date        date NOT NULL,
  status              queue_sessions_status_enum NOT NULL DEFAULT 'waiting_for_doctor',
  last_token_number   integer NOT NULL DEFAULT 0,
  token_prefix        varchar(6) NOT NULL,
  smart_queue_enabled boolean NOT NULL,
  last_call_reason    text,
  pause_reason        text,
  started_at          timestamptz,
  closed_at           timestamptz,
  event_seq           bigint NOT NULL DEFAULT 0,
  version             integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_queue_session_doctor_day UNIQUE (organization_id, location_id, doctor_id, service_date),
  CONSTRAINT chk_queue_sessions_1 CHECK ("last_token_number" >= 0),
  CONSTRAINT fk_queue_sessions_doctor_id FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- inventory_categories   (src/inventory/entities/inventory-category.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE inventory_categories (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" uuid NOT NULL,
  name             varchar NOT NULL,
  description      text,
  "sortOrder"      integer NOT NULL DEFAULT 0,
  "isActive"       boolean NOT NULL DEFAULT true,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_inventory_categories_organizationId" FOREIGN KEY ("organizationId") REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX "idx_inventory_categories_organizationId_isActive" ON inventory_categories ("organizationId", "isActive");

-- ------------------------------------------------------------------------
-- queue_entries   (src/queue/entities/queue-entry.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE queue_entries_queue_type_enum AS ENUM ('appointment', 'walk_in');
CREATE TYPE queue_entries_status_enum AS ENUM ('waiting', 'called', 'in_consultation', 'on_hold', 'skipped', 'completed', 'cancelled', 'transferred', 'aborted');
CREATE TYPE queue_entries_priority_class_enum AS ENUM ('normal', 'authorized_urgent');
CREATE TABLE queue_entries (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id         uuid NOT NULL,
  queue_session_id        uuid NOT NULL,
  patient_id              uuid NOT NULL,
  appointment_id          uuid,
  converted_from_appt_id  uuid,
  transferred_from_id     uuid,
  token_number            integer NOT NULL,
  queue_type              queue_entries_queue_type_enum NOT NULL,
  status                  queue_entries_status_enum NOT NULL DEFAULT 'waiting',
  priority_class          queue_entries_priority_class_enum NOT NULL DEFAULT 'normal',
  urgent_since            timestamptz,
  urgent_reason           text,
  reason_for_visit        text,
  checked_in_at           timestamptz NOT NULL,
  sort_anchor_at          timestamptz NOT NULL,
  called_at               timestamptz,
  consultation_started_at timestamptz,
  hold_started_at         timestamptz,
  returned_from_hold_at   timestamptz,
  skipped_at              timestamptz,
  finished_at             timestamptz,
  version                 integer NOT NULL DEFAULT 0,
  CONSTRAINT uq_queue_entry_session_token UNIQUE (queue_session_id, token_number),
  CONSTRAINT chk_queue_entries_1 CHECK ("priority_class" = 'normal' OR ("urgent_since" IS NOT NULL AND "urgent_reason" IS NOT NULL)),
  CONSTRAINT chk_queue_entries_2 CHECK (("queue_type" = 'appointment') = ("appointment_id" IS NOT NULL)),
  CONSTRAINT chk_queue_entries_3 CHECK ("token_number" > 0),
  CONSTRAINT fk_queue_entries_queue_session_id FOREIGN KEY (queue_session_id) REFERENCES queue_sessions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_queue_entries_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_queue_entries_appointment_id FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE
);
CREATE INDEX idx_queue_entries_organization_id_patient_id ON queue_entries (organization_id, patient_id);
CREATE INDEX entries_waiting ON queue_entries (queue_session_id, sort_anchor_at) WHERE "status" = 'waiting';
CREATE UNIQUE INDEX one_patient_with_doctor ON queue_entries (queue_session_id) WHERE "status" IN ('called','in_consultation');
CREATE UNIQUE INDEX one_active_entry_per_patient ON queue_entries (queue_session_id, patient_id) WHERE "status" IN ('waiting','called','in_consultation','on_hold','skipped');
CREATE UNIQUE INDEX one_active_entry_per_appt ON queue_entries (appointment_id) WHERE "status" IN ('waiting','called','in_consultation','on_hold','skipped');

-- ------------------------------------------------------------------------
-- compensation_plans   (src/billing/commissions/entities/compensation-plan.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE compensation_plans_type_enum AS ENUM ('SALARY', 'COMMISSION', 'SALARY_PLUS_COMMISSION');
CREATE TYPE compensation_plans_commission_basis_enum AS ENUM ('NET', 'GROSS');
CREATE TABLE compensation_plans (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   uuid NOT NULL,
  assignment_id     uuid NOT NULL,
  type              compensation_plans_type_enum NOT NULL,
  base_salary_minor bigint,
  default_rate_bps  integer,
  commission_basis  compensation_plans_commission_basis_enum NOT NULL DEFAULT 'NET',
  effective_from    date NOT NULL,
  effective_to      date,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_compensation_plans_dates CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT chk_compensation_plans_salary CHECK ("base_salary_minor" IS NULL OR "base_salary_minor" >= 0),
  CONSTRAINT chk_compensation_plans_rate CHECK ("default_rate_bps" IS NULL OR "default_rate_bps" BETWEEN 0 AND 10000),
  CONSTRAINT chk_compensation_plans_fields CHECK (("type" = 'SALARY' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NULL)
   OR ("type" = 'COMMISSION' AND "default_rate_bps" IS NOT NULL AND "base_salary_minor" IS NULL)
   OR ("type" = 'SALARY_PLUS_COMMISSION' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NOT NULL)),
  CONSTRAINT excl_compensation_plans_overlap EXCLUDE USING gist ("assignment_id" WITH =, daterange("effective_from", "effective_to", '[]') WITH &&),
  CONSTRAINT fk_compensation_plans_assignment_id FOREIGN KEY (assignment_id) REFERENCES employee_org_location_assignments (id) ON DELETE CASCADE
);
CREATE INDEX idx_compensation_plans_assignment ON compensation_plans (assignment_id, effective_from);

-- ------------------------------------------------------------------------
-- patient_encounters   (src/encounters/entities/patient-encounter.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_encounters (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_entry_id  uuid NOT NULL,
  appointment_id  uuid,
  patient_id      uuid NOT NULL,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  encounter_date  timestamptz NOT NULL,
  reason          text,
  chief_complaint text,
  examination     text,
  diagnosis       text,
  advice          text,
  follow_up_date  date,
  created_by      uuid,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_patient_encounters_queue_entry_id UNIQUE (queue_entry_id),
  CONSTRAINT fk_patient_encounters_queue_entry_id FOREIGN KEY (queue_entry_id) REFERENCES queue_entries (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_encounters_appointment_id FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL,
  CONSTRAINT fk_patient_encounters_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_encounters_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_encounters_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_encounters_encounter_date ON patient_encounters (encounter_date);
CREATE INDEX idx_patient_encounters_patient_id ON patient_encounters (patient_id);
CREATE INDEX idx_patient_encounters_location_id ON patient_encounters (location_id);
CREATE INDEX idx_patient_encounters_organization_id ON patient_encounters (organization_id);
CREATE INDEX idx_patient_encounters_appointment_id ON patient_encounters (appointment_id);

-- ------------------------------------------------------------------------
-- inventory_items   (src/inventory/entities/inventory-item.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE inventory_items_unit_enum AS ENUM ('pieces', 'boxes', 'pairs', 'rolls', 'bottles', 'packets', 'cartridges', 'tubes', 'ml', 'gm', 'kg', 'liters');
CREATE TABLE inventory_items (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId"  uuid NOT NULL,
  "locationId"      uuid NOT NULL,
  "categoryId"      uuid,
  name              varchar NOT NULL,
  sku               varchar,
  barcode           varchar,
  description       text,
  "currentStock"    numeric(10,2) NOT NULL DEFAULT 0,
  unit              inventory_items_unit_enum NOT NULL DEFAULT 'pieces',
  "unitPrice"       numeric(10,2) NOT NULL DEFAULT 0,
  "sellingPrice"    numeric(10,2),
  "reorderLevel"    integer NOT NULL DEFAULT 10,
  "reorderQuantity" integer NOT NULL DEFAULT 50,
  "maxStock"        integer,
  "expiryDate"      date,
  "expiryAlertDays" integer NOT NULL DEFAULT 30,
  "isBillable"      boolean NOT NULL DEFAULT false,
  "isActive"        boolean NOT NULL DEFAULT true,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_inventory_items_organizationId" FOREIGN KEY ("organizationId") REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT "fk_inventory_items_locationId" FOREIGN KEY ("locationId") REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT "fk_inventory_items_categoryId" FOREIGN KEY ("categoryId") REFERENCES inventory_categories (id) ON DELETE SET NULL
);
CREATE INDEX "idx_inventory_items_expiryDate" ON inventory_items ("expiryDate");
CREATE INDEX "idx_inventory_items_organizationId_locationId_currentStock" ON inventory_items ("organizationId", "locationId", "currentStock");
CREATE INDEX "idx_inventory_items_organizationId_locationId_isActive" ON inventory_items ("organizationId", "locationId", "isActive");

-- ------------------------------------------------------------------------
-- notification_events   (src/notifications/entities/notification-event.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE notification_events (
  code                  text PRIMARY KEY,
  name                  text NOT NULL,
  description           text NOT NULL,
  audiences             text[] NOT NULL,
  is_mandatory_internal boolean NOT NULL DEFAULT false,
  email_default         boolean NOT NULL DEFAULT false,
  channels              text[],
  variables             text[] NOT NULL DEFAULT '{}',
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- prescription_presets   (src/prescriptions/entities/prescription-preset.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE prescription_presets_category_enum AS ENUM ('GENERAL', 'PAIN_RELIEF', 'TOOTHACHE', 'TOOTH_SENSITIVITY', 'SWELLING_AND_INFLAMMATION', 'FEVER', 'ALLERGY', 'INFECTION_ANTIBIOTIC', 'DENTAL_ABSCESS', 'ROOT_CANAL', 'POST_ROOT_CANAL', 'FILLING_AND_RESTORATIVE', 'EXTRACTION', 'POST_EXTRACTION', 'WISDOM_TOOTH', 'DRY_SOCKET', 'ORAL_SURGERY', 'POST_OPERATIVE', 'ANESTHESIA_AFTERCARE', 'IMPLANT', 'CROWN_AND_BRIDGE', 'DENTURE', 'ORTHODONTIC', 'SCALING_AND_CLEANING', 'TEETH_WHITENING_COSMETIC', 'GUM_DISEASE', 'MOUTH_ULCERS', 'ORAL_FUNGAL_INFECTION', 'BAD_BREATH', 'DRY_MOUTH', 'TMJ_DISORDER', 'DENTAL_TRAUMA', 'EMERGENCY', 'PEDIATRIC', 'PREGNANCY_SAFE', 'ELDERLY', 'DIABETIC_PATIENT', 'PREVENTIVE_CARE', 'VITAMINS_AND_SUPPLEMENTS', 'OTHER');
CREATE TABLE prescription_presets (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id      uuid NOT NULL,
  name                 varchar(200) NOT NULL,
  description          text,
  category             prescription_presets_category_enum NOT NULL DEFAULT 'GENERAL',
  specialty_tags       jsonb NOT NULL DEFAULT '["general"]',
  further_plan         text,
  instructions_english text,
  instructions_urdu    text,
  is_active            boolean NOT NULL DEFAULT true,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_prescription_presets_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_prescription_presets_organization_id_category ON prescription_presets (organization_id, category);
CREATE INDEX idx_prescription_presets_organization_id_is_active ON prescription_presets (organization_id, is_active);

-- ------------------------------------------------------------------------
-- invoices   (src/billing/entities/invoice.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE invoices_status_enum AS ENUM ('ISSUED', 'CANCELLED');
CREATE TABLE invoices (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  patient_id      uuid NOT NULL,
  invoice_number  varchar(30) NOT NULL,
  status          invoices_status_enum NOT NULL DEFAULT 'ISSUED',
  revision        integer NOT NULL DEFAULT 1,
  issue_date      date NOT NULL,
  issued_at       timestamptz NOT NULL,
  due_date        date NOT NULL,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  discount_total  numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate        numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0,
  total_amount    numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount     numeric(12,2) NOT NULL DEFAULT 0,
  balance_due     numeric(12,2) NOT NULL DEFAULT 0,
  released_amount numeric(12,2) NOT NULL DEFAULT 0,
  refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes           varchar(500),
  issued_by       uuid NOT NULL,
  last_edited_at  timestamptz,
  last_edited_by  uuid,
  cancelled_at    timestamptz,
  cancelled_by    uuid,
  cancel_reason   varchar(300),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_invoices_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT
);
CREATE INDEX idx_invoices_open ON invoices (organization_id, location_id, status, balance_due);
CREATE INDEX idx_invoices_issue_date ON invoices (organization_id, location_id, issue_date);
CREATE INDEX idx_invoices_patient ON invoices (organization_id, location_id, patient_id);
CREATE UNIQUE INDEX uq_invoices_org_number ON invoices (organization_id, invoice_number);

-- ------------------------------------------------------------------------
-- payment_accounts   (src/billing/entities/payment-account.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE payment_accounts_method_enum AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_WALLET');
CREATE TABLE payment_accounts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id       uuid NOT NULL,
  location_id           uuid NOT NULL,
  name                  varchar(60) NOT NULL,
  method                payment_accounts_method_enum NOT NULL,
  bank_name             varchar(80),
  account_title         varchar(120),
  account_number        varchar(40),
  requires_reference    boolean NOT NULL DEFAULT false,
  counted_in_cash_close boolean NOT NULL DEFAULT false,
  is_active             boolean NOT NULL DEFAULT true,
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_payment_accounts_loc_name ON payment_accounts (organization_id, location_id, name);

-- ------------------------------------------------------------------------
-- services   (src/billing/entities/catalog-service.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE services_kind_enum AS ENUM ('CONSULTATION', 'PROCEDURE', 'OTHER');
CREATE TABLE services (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name            varchar(120) NOT NULL,
  code            varchar(30),
  kind            services_kind_enum NOT NULL,
  default_price   numeric(12,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_org_active_kind ON services (organization_id, is_active, kind);
CREATE UNIQUE INDEX uq_services_org_code ON services (organization_id, code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX uq_services_org_name ON services (organization_id, name);

-- ------------------------------------------------------------------------
-- consumption_templates   (src/inventory/entities/consumption-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE consumption_templates (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId"  uuid NOT NULL,
  name              varchar NOT NULL,
  "procedureName"   varchar NOT NULL,
  "appointmentType" varchar,
  "isActive"        boolean NOT NULL DEFAULT true,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_consumption_templates_organizationId" FOREIGN KEY ("organizationId") REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX "idx_consumption_templates_organizationId_appointmentType" ON consumption_templates ("organizationId", "appointmentType");
CREATE INDEX "idx_consumption_templates_organizationId_isActive" ON consumption_templates ("organizationId", "isActive");

-- ------------------------------------------------------------------------
-- prescription_templates   (src/prescriptions/entities/prescription-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE prescription_templates_page_size_enum AS ENUM ('A4', 'A5', 'LETTER', 'CUSTOM');
CREATE TYPE prescription_templates_orientation_enum AS ENUM ('PORTRAIT', 'LANDSCAPE');
CREATE TABLE prescription_templates (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  uuid NOT NULL,
  location_id      uuid,
  name             varchar(150) NOT NULL,
  is_default       boolean NOT NULL DEFAULT false,
  page_size        prescription_templates_page_size_enum NOT NULL DEFAULT 'A4',
  orientation      prescription_templates_orientation_enum NOT NULL DEFAULT 'PORTRAIT',
  custom_width_mm  numeric(6,2),
  custom_height_mm numeric(6,2),
  header           jsonb NOT NULL DEFAULT '{}',
  footer           jsonb NOT NULL DEFAULT '{}',
  styling          jsonb NOT NULL DEFAULT '{}',
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_prescription_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_prescription_templates_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);
CREATE INDEX idx_prescription_templates_location_id_is_default ON prescription_templates (location_id, is_default);
CREATE INDEX idx_prescription_templates_organization_id_is_active ON prescription_templates (organization_id, is_active);

-- ------------------------------------------------------------------------
-- charges   (src/billing/entities/charge.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE charges_source_enum AS ENUM ('CONSULTATION', 'TREATMENT', 'TREATMENT_PLAN', 'MANUAL');
CREATE TYPE charges_service_kind_enum AS ENUM ('CONSULTATION', 'PROCEDURE', 'OTHER');
CREATE TYPE charges_discount_kind_enum AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE charges_status_enum AS ENUM ('ACTIVE', 'VOID');
CREATE TABLE charges (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id          uuid NOT NULL,
  location_id              uuid NOT NULL,
  patient_id               uuid NOT NULL,
  source                   charges_source_enum NOT NULL,
  source_id                uuid,
  encounter_id             uuid,
  appointment_id           uuid,
  doctor_id                uuid,
  service_id               uuid,
  performing_assignment_id uuid,
  commission_plan_id       uuid,
  commission_rate_bps      integer,
  commission_fixed_minor   bigint,
  service_kind             charges_service_kind_enum NOT NULL DEFAULT 'OTHER',
  description              varchar(200) NOT NULL,
  quantity                 integer NOT NULL DEFAULT 1,
  unit_price               numeric(12,2) NOT NULL DEFAULT 0,
  gross_amount             numeric(12,2) NOT NULL DEFAULT 0,
  discount_type_id         uuid,
  discount_name            varchar(80),
  discount_kind            charges_discount_kind_enum,
  discount_value           numeric(12,2),
  discount_amount          numeric(12,2) NOT NULL DEFAULT 0,
  discount_note            varchar(200),
  discount_applied_by      uuid,
  is_custom_discount       boolean NOT NULL DEFAULT false,
  net_amount               numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount               numeric(12,2) NOT NULL DEFAULT 0,
  allocated_amount         numeric(12,2) NOT NULL DEFAULT 0,
  invoice_id               uuid,
  charge_date              date NOT NULL,
  needs_pricing            boolean NOT NULL DEFAULT false,
  status                   charges_status_enum NOT NULL DEFAULT 'ACTIVE',
  voided_at                timestamptz,
  voided_by                uuid,
  void_reason              varchar(300),
  source_removed_at        timestamptz,
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_charges_commission_rate CHECK ("commission_rate_bps" IS NULL OR "commission_rate_bps" BETWEEN 0 AND 10000),
  CONSTRAINT fk_charges_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_charges_doctor_id FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_charges_performing_assignment_id FOREIGN KEY (performing_assignment_id) REFERENCES employee_org_location_assignments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_charges_commission_plan_id FOREIGN KEY (commission_plan_id) REFERENCES compensation_plans (id) ON DELETE RESTRICT,
  CONSTRAINT fk_charges_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_charges_source ON charges (organization_id, source, source_id) WHERE status = 'ACTIVE' AND source_id IS NOT NULL;
CREATE INDEX idx_charges_date ON charges (organization_id, location_id, charge_date);
CREATE INDEX idx_charges_invoice ON charges (invoice_id);
CREATE INDEX idx_charges_patient_open ON charges (organization_id, location_id, patient_id, status, invoice_id);

-- ------------------------------------------------------------------------
-- payments   (src/billing/entities/payment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE payments_method_enum AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_WALLET');
CREATE TABLE payments (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id      uuid NOT NULL,
  location_id          uuid NOT NULL,
  patient_id           uuid NOT NULL,
  receipt_number       varchar(30) NOT NULL,
  amount               numeric(12,2) NOT NULL DEFAULT 0,
  payment_account_id   uuid NOT NULL,
  method               payments_method_enum NOT NULL,
  payment_account_name varchar(60) NOT NULL,
  reference_number     varchar(80),
  payment_date         date NOT NULL,
  received_at          timestamptz NOT NULL,
  received_by          uuid NOT NULL,
  notes                varchar(300),
  allocated_amount     numeric(12,2) NOT NULL DEFAULT 0,
  refunded_amount      numeric(12,2) NOT NULL DEFAULT 0,
  client_request_id    uuid NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_payments_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_payment_account_id FOREIGN KEY (payment_account_id) REFERENCES payment_accounts (id) ON DELETE RESTRICT
);
CREATE INDEX idx_payments_account_received ON payments (payment_account_id, received_at);
CREATE INDEX idx_payments_date ON payments (organization_id, location_id, payment_date);
CREATE INDEX idx_payments_patient ON payments (organization_id, location_id, patient_id);
CREATE UNIQUE INDEX uq_payments_org_client_request ON payments (organization_id, client_request_id);
CREATE UNIQUE INDEX uq_payments_org_receipt ON payments (organization_id, receipt_number);

-- ------------------------------------------------------------------------
-- stage_template_steps   (src/engine/entities/stage-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE stage_template_steps (
  id                       uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  stage_template_id        uuid NOT NULL,
  seq                      integer NOT NULL,
  code                     varchar(50) NOT NULL,
  name                     varchar(100) NOT NULL,
  requires_patient_visit   boolean NOT NULL DEFAULT true,
  requires_doctor_approval boolean NOT NULL DEFAULT true,
  default_lab_days         integer NOT NULL DEFAULT 3,
  CONSTRAINT uq_stage_template_steps_code UNIQUE (stage_template_id, code),
  CONSTRAINT uq_stage_template_steps_seq UNIQUE (stage_template_id, seq),
  CONSTRAINT chk_stage_template_steps_seq CHECK ("seq" > 0),
  CONSTRAINT chk_stage_template_steps_days CHECK ("default_lab_days" BETWEEN 0 AND 365),
  CONSTRAINT fk_stage_template_steps_stage_template_id FOREIGN KEY (stage_template_id) REFERENCES stage_templates (id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------
-- workflow_states   (src/engine/entities/workflow-state.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE workflow_states_category_enum AS ENUM ('initial', 'active', 'waiting', 'done', 'cancelled');
CREATE TABLE workflow_states (
  id                  uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  template_version_id uuid NOT NULL,
  code                varchar(50) NOT NULL,
  name                varchar(100) NOT NULL,
  category            workflow_states_category_enum NOT NULL,
  is_terminal         boolean NOT NULL,
  sort_order          integer NOT NULL,
  CONSTRAINT uq_workflow_states_code UNIQUE (template_version_id, code),
  CONSTRAINT fk_workflow_states_template_version_id FOREIGN KEY (template_version_id) REFERENCES workflow_template_versions (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- suppliers   (src/inventory/entities/supplier.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE suppliers (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" uuid NOT NULL,
  name             varchar NOT NULL,
  "contactPerson"  varchar,
  phone            varchar,
  email            varchar,
  address          text,
  city             varchar,
  website          varchar,
  notes            text,
  "isActive"       boolean NOT NULL DEFAULT true,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_suppliers_organizationId" FOREIGN KEY ("organizationId") REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX "idx_suppliers_organizationId_isActive" ON suppliers ("organizationId", "isActive");

-- ------------------------------------------------------------------------
-- lab_credit_notes   (src/lab-billing/entities/lab-credit.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_credit_notes_status_enum AS ENUM ('issued', 'applied', 'refunded');
CREATE TABLE lab_credit_notes (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  credit_note_no  varchar(30) NOT NULL,
  invoice_id      uuid NOT NULL,
  patient_id      uuid NOT NULL,
  amount_minor    bigint NOT NULL DEFAULT 0,
  reason          text NOT NULL,
  status          lab_credit_notes_status_enum NOT NULL,
  released_minor  bigint NOT NULL DEFAULT 0,
  refunded_minor  bigint NOT NULL DEFAULT 0,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_credit_notes_org_no UNIQUE (organization_id, credit_note_no),
  CONSTRAINT chk_lab_credit_notes_amounts CHECK ("amount_minor" > 0 AND "released_minor" BETWEEN 0 AND "amount_minor" AND "refunded_minor" BETWEEN 0 AND "released_minor"),
  CONSTRAINT fk_lab_credit_notes_invoice_id FOREIGN KEY (invoice_id) REFERENCES lab_invoices (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_credit_notes_invoice ON lab_credit_notes (invoice_id);

-- ------------------------------------------------------------------------
-- lab_payments   (src/lab-billing/entities/lab-payment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_payments_method_enum AS ENUM ('cash', 'card', 'bank_transfer', 'wallet');
CREATE TYPE lab_payments_status_enum AS ENUM ('posted', 'reversed');
CREATE TABLE lab_payments (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  receipt_no      varchar(30) NOT NULL,
  patient_id      uuid NOT NULL,
  amount_minor    bigint NOT NULL DEFAULT 0,
  currency        char(3) NOT NULL DEFAULT 'PKR',
  method          lab_payments_method_enum NOT NULL,
  reference       varchar(80),
  notes           text,
  received_at     timestamptz NOT NULL,
  received_on     date NOT NULL,
  received_by     uuid NOT NULL,
  status          lab_payments_status_enum NOT NULL DEFAULT 'posted',
  reversal_of_id  uuid,
  reason          text,
  allocated_minor bigint NOT NULL DEFAULT 0,
  refunded_minor  bigint NOT NULL DEFAULT 0,
  idempotency_key varchar(150) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lab_payments_reversal_of UNIQUE (reversal_of_id),
  CONSTRAINT uq_lab_payments_org_idempotency UNIQUE (organization_id, idempotency_key),
  CONSTRAINT uq_lab_payments_org_receipt UNIQUE (organization_id, receipt_no),
  CONSTRAINT chk_lab_payments_amounts CHECK ("amount_minor" <> 0 AND "allocated_minor" >= 0 AND "refunded_minor" >= 0 AND ("reversal_of_id" IS NULL) = ("amount_minor" > 0) AND "allocated_minor" + "refunded_minor" <= GREATEST("amount_minor", 0)),
  CONSTRAINT fk_lab_payments_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_payments_reversal_of_id FOREIGN KEY (reversal_of_id) REFERENCES lab_payments (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_payments_received ON lab_payments (organization_id, received_on);
CREATE INDEX idx_lab_payments_patient ON lab_payments (organization_id, patient_id);

-- ------------------------------------------------------------------------
-- order_charge_requests   (src/lab-orders/entities/order-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE order_charge_requests_kind_enum AS ENUM ('rush', 'material', 'shipping', 'other');
CREATE TYPE order_charge_requests_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TABLE order_charge_requests (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  order_id        uuid NOT NULL,
  item_id         uuid,
  kind            order_charge_requests_kind_enum NOT NULL,
  amount_minor    bigint NOT NULL DEFAULT 0,
  currency        char(3) NOT NULL DEFAULT 'PKR',
  reason          text NOT NULL,
  status          order_charge_requests_status_enum NOT NULL DEFAULT 'pending',
  requested_by    uuid,
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_order_charge_requests_amount CHECK ("amount_minor" > 0),
  CONSTRAINT fk_order_charge_requests_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_charge_requests_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT
);
CREATE INDEX idx_order_charge_requests_order ON order_charge_requests (order_id, status);

-- ------------------------------------------------------------------------
-- vendor_bills   (src/lab-payables/entities/vendor-bill.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE vendor_bills_status_enum AS ENUM ('draft', 'approved', 'partially_paid', 'paid', 'void');
CREATE TABLE vendor_bills (
  id                uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id   uuid NOT NULL,
  location_id       uuid NOT NULL,
  lab_id            uuid NOT NULL,
  lab_order_id      uuid,
  bill_no           varchar(30) NOT NULL,
  vendor_invoice_no varchar(60),
  statement_id      uuid,
  status            vendor_bills_status_enum NOT NULL DEFAULT 'draft',
  bill_date         date NOT NULL,
  due_on            date,
  subtotal_minor    bigint NOT NULL DEFAULT 0,
  tax_bp            integer NOT NULL DEFAULT 0,
  tax_minor         bigint NOT NULL DEFAULT 0,
  total_minor       bigint NOT NULL DEFAULT 0,
  paid_minor        bigint NOT NULL DEFAULT 0,
  balance_minor     bigint NOT NULL DEFAULT 0,
  currency          char(3) NOT NULL DEFAULT 'PKR',
  notes             text,
  approved_by       uuid,
  approved_at       timestamptz,
  journal_id        uuid,
  voided_by         uuid,
  voided_at         timestamptz,
  void_reason       text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  version           integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_vendor_bills_minor CHECK ("subtotal_minor" >= 0 AND "tax_minor" >= 0 AND "total_minor" = "subtotal_minor" + "tax_minor" AND "paid_minor" >= 0 AND "balance_minor" >= 0),
  CONSTRAINT fk_vendor_bills_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_vendor_bills_order_draft ON vendor_bills (lab_order_id) WHERE "status" = 'draft' AND "lab_order_id" IS NOT NULL;
CREATE INDEX idx_vendor_bills_order ON vendor_bills (lab_order_id);
CREATE INDEX idx_vendor_bills_lab_status_due ON vendor_bills (lab_id, status, due_on);
CREATE UNIQUE INDEX uq_vendor_bills_vendor_invoice ON vendor_bills (organization_id, lab_id, vendor_invoice_no) WHERE "vendor_invoice_no" IS NOT NULL AND "status" <> 'void';
CREATE UNIQUE INDEX uq_vendor_bills_no ON vendor_bills (organization_id, bill_no);

-- ------------------------------------------------------------------------
-- payroll_records   (src/payroll/entities/payroll-record.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE payroll_records_status_enum AS ENUM ('pending', 'paid', 'on_hold');
CREATE TYPE payroll_records_payment_method_enum AS ENUM ('cash', 'bank_transfer', 'cheque');
CREATE TABLE payroll_records (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id       uuid NOT NULL,
  organization_id   uuid NOT NULL,
  location_id       uuid NOT NULL,
  month             integer NOT NULL,
  year              integer NOT NULL,
  period_label      varchar(50) NOT NULL,
  salary_amount     numeric(10,2) NOT NULL,
  base_salary_minor bigint NOT NULL DEFAULT 0,
  commission_minor  bigint NOT NULL DEFAULT 0,
  total_minor       bigint NOT NULL DEFAULT 0,
  status            payroll_records_status_enum NOT NULL DEFAULT 'pending',
  paid_at           timestamptz,
  payment_method    payroll_records_payment_method_enum,
  payment_reference varchar,
  paid_by           uuid,
  notes             text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_records_employee_id_location_id_month_year UNIQUE (employee_id, location_id, month, year),
  CONSTRAINT fk_payroll_records_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_records_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_records_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);
CREATE INDEX idx_payroll_records_employee_id_year ON payroll_records (employee_id, year);
CREATE INDEX idx_payroll_records_organization_id_location_id_month_year ON payroll_records (organization_id, location_id, month, year);

-- ------------------------------------------------------------------------
-- medicine_directory   (src/prescriptions/entities/medicine-directory.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE medicine_directory_type_enum AS ENUM ('TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'CREAM', 'DROPS', 'INHALER', 'SACHET', 'SUPPOSITORY', 'OINTMENT', 'GEL', 'PATCH', 'SPRAY', 'POWDER', 'OTHER');
CREATE TYPE medicine_directory_default_meal_relation_enum AS ENUM ('BEFORE_MEAL', 'AFTER_MEAL', 'WITH_MEAL', 'EMPTY_STOMACH', 'NONE');
CREATE TABLE medicine_directory (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id       uuid NOT NULL,
  name                  varchar(200) NOT NULL,
  generic_name          varchar(200),
  name_urdu             varchar(200),
  type                  medicine_directory_type_enum NOT NULL DEFAULT 'TABLET',
  strength              varchar(100),
  manufacturer          varchar(150),
  default_dosage        varchar(100),
  default_frequency     varchar(100),
  default_duration      varchar(100),
  default_meal_relation medicine_directory_default_meal_relation_enum NOT NULL DEFAULT 'NONE',
  instructions_urdu     text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_medicine_directory_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_medicine_directory_organization_id_name ON medicine_directory (organization_id, name);
CREATE INDEX idx_medicine_directory_organization_id_is_active ON medicine_directory (organization_id, is_active);

-- ------------------------------------------------------------------------
-- prescriptions   (src/prescriptions/entities/prescription.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE prescriptions_status_enum AS ENUM ('DRAFT', 'FINALIZED', 'AMENDED');
CREATE TABLE prescriptions (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_number      varchar(30) NOT NULL,
  organization_id          uuid NOT NULL,
  location_id              uuid NOT NULL,
  patient_id               uuid NOT NULL,
  appointment_id           uuid,
  encounter_id             uuid,
  doctor_id                uuid,
  prescription_template_id uuid,
  prescription_preset_id   uuid,
  diagnosis                text,
  chief_complaint          text,
  further_plan             text,
  instructions_english     text,
  instructions_urdu        text,
  vitals                   jsonb,
  signature_image_url      text,
  signed_at                timestamptz,
  status                   prescriptions_status_enum NOT NULL DEFAULT 'DRAFT',
  pdf_url                  text,
  version                  integer NOT NULL DEFAULT 1,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_prescriptions_organization_id_prescription_number UNIQUE (organization_id, prescription_number),
  CONSTRAINT fk_prescriptions_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_prescriptions_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_prescriptions_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_prescriptions_appointment_id FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL,
  CONSTRAINT fk_prescriptions_encounter_id FOREIGN KEY (encounter_id) REFERENCES patient_encounters (id) ON DELETE SET NULL,
  CONSTRAINT fk_prescriptions_doctor_id FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE SET NULL,
  CONSTRAINT fk_prescriptions_prescription_template_id FOREIGN KEY (prescription_template_id) REFERENCES prescription_templates (id) ON DELETE SET NULL,
  CONSTRAINT fk_prescriptions_prescription_preset_id FOREIGN KEY (prescription_preset_id) REFERENCES prescription_presets (id) ON DELETE SET NULL
);
CREATE INDEX idx_prescriptions_doctor_id ON prescriptions (doctor_id);
CREATE INDEX idx_prescriptions_encounter_id ON prescriptions (encounter_id);
CREATE INDEX idx_prescriptions_appointment_id ON prescriptions (appointment_id);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions (patient_id);
CREATE INDEX idx_prescriptions_organization_id_location_id ON prescriptions (organization_id, location_id);

-- ------------------------------------------------------------------------
-- cash_closes   (src/billing/entities/cash-close.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE cash_closes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  business_date   date NOT NULL,
  total_expected  numeric(12,2) NOT NULL,
  total_counted   numeric(12,2) NOT NULL DEFAULT 0,
  total_variance  numeric(12,2) NOT NULL,
  note            varchar(500),
  closed_by       uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_cash_closes_loc_end ON cash_closes (organization_id, location_id, period_end);

-- ------------------------------------------------------------------------
-- commission_settlements   (src/billing/commissions/entities/commission-settlement.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE commission_settlements_status_enum AS ENUM ('PENDING', 'PAID');
CREATE TABLE commission_settlements (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   uuid NOT NULL,
  location_id       uuid NOT NULL,
  assignment_id     uuid NOT NULL,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  total_minor       bigint NOT NULL DEFAULT 0,
  status            commission_settlements_status_enum NOT NULL DEFAULT 'PENDING',
  payroll_record_id uuid,
  paid_at           timestamptz,
  paid_by           uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_commission_settlements_payroll_record_id UNIQUE (payroll_record_id),
  CONSTRAINT fk_commission_settlements_assignment_id FOREIGN KEY (assignment_id) REFERENCES employee_org_location_assignments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_commission_settlements_payroll_record_id FOREIGN KEY (payroll_record_id) REFERENCES payroll_records (id) ON DELETE RESTRICT
);
CREATE INDEX idx_commission_settlements_assignment ON commission_settlements (assignment_id, period_end);

-- ------------------------------------------------------------------------
-- credit_packages   (src/billing/entities/credit-package.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE credit_packages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name            varchar(150) NOT NULL,
  description     text,
  total_credits   numeric(10,2) NOT NULL,
  price           numeric(10,2) NOT NULL,
  validity_days   integer,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_credit_packages_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_credit_packages_organization_id_is_active ON credit_packages (organization_id, is_active);

-- ------------------------------------------------------------------------
-- ledger_journals   (src/billing/ledger/journal/ledger-journal.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE ledger_journals_source_type_enum AS ENUM ('vendor_bill', 'vendor_payment', 'expense', 'invoice', 'payment', 'credit_note', 'refund', 'commission');
CREATE TABLE ledger_journals (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid,
  entry_on        date NOT NULL,
  source_type     ledger_journals_source_type_enum NOT NULL,
  source_id       uuid NOT NULL,
  reversal_of_id  uuid,
  memo            varchar(200) NOT NULL,
  total_minor     bigint NOT NULL DEFAULT 0,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_ledger_journals_reversal ON ledger_journals (reversal_of_id) WHERE "reversal_of_id" IS NOT NULL;
CREATE INDEX idx_ledger_journals_source ON ledger_journals (organization_id, source_type, source_id);

-- ------------------------------------------------------------------------
-- refunds   (src/billing/entities/refund.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE refunds_method_enum AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_WALLET');
CREATE TABLE refunds (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id      uuid NOT NULL,
  location_id          uuid NOT NULL,
  patient_id           uuid NOT NULL,
  refund_number        varchar(30) NOT NULL,
  amount               numeric(12,2) NOT NULL DEFAULT 0,
  payment_account_id   uuid NOT NULL,
  method               refunds_method_enum NOT NULL,
  payment_account_name varchar(60) NOT NULL,
  reference_number     varchar(80),
  reason               varchar(300) NOT NULL,
  refund_date          date NOT NULL,
  refunded_at          timestamptz NOT NULL,
  refunded_by          uuid NOT NULL,
  invoice_id           uuid,
  client_request_id    uuid NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_refunds_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT
);
CREATE INDEX idx_refunds_account_refunded ON refunds (payment_account_id, refunded_at);
CREATE INDEX idx_refunds_invoice ON refunds (invoice_id);
CREATE INDEX idx_refunds_patient ON refunds (organization_id, location_id, patient_id);
CREATE UNIQUE INDEX uq_refunds_org_client_request ON refunds (organization_id, client_request_id);
CREATE UNIQUE INDEX uq_refunds_org_number ON refunds (organization_id, refund_number);

-- ------------------------------------------------------------------------
-- workflow_effects   (src/engine/entities/workflow-effect.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE workflow_effects (
  code         varchar(60) PRIMARY KEY,
  description  text NOT NULL,
  is_financial boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- workflow_transitions   (src/engine/entities/workflow-transition.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE workflow_transitions (
  id                  uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  template_version_id uuid NOT NULL,
  from_state_id       uuid NOT NULL,
  to_state_id         uuid NOT NULL,
  action_code         varchar(50) NOT NULL,
  allowed_roles       text[] NOT NULL DEFAULT '{}',
  allowed_sides       text[] NOT NULL,
  required_fields     jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_reason     boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_workflow_transitions_move UNIQUE (template_version_id, from_state_id, action_code, to_state_id),
  CONSTRAINT fk_workflow_transitions_template_version_id FOREIGN KEY (template_version_id) REFERENCES workflow_template_versions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_workflow_transitions_from_state_id FOREIGN KEY (from_state_id) REFERENCES workflow_states (id) ON DELETE RESTRICT,
  CONSTRAINT fk_workflow_transitions_to_state_id FOREIGN KEY (to_state_id) REFERENCES workflow_states (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- patient_consumptions   (src/inventory/entities/patient-consumption.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_consumptions (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId"  uuid NOT NULL,
  "locationId"      uuid NOT NULL,
  "patientId"       uuid NOT NULL,
  "appointmentId"   uuid,
  "treatmentPlanId" uuid,
  "templateId"      uuid,
  "performedBy"     uuid NOT NULL,
  "totalCost"       numeric(10,2) NOT NULL DEFAULT 0,
  notes             text,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_patient_consumptions_organizationId" FOREIGN KEY ("organizationId") REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT "fk_patient_consumptions_locationId" FOREIGN KEY ("locationId") REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT "fk_patient_consumptions_patientId" FOREIGN KEY ("patientId") REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT "fk_patient_consumptions_appointmentId" FOREIGN KEY ("appointmentId") REFERENCES appointments (id) ON DELETE SET NULL,
  CONSTRAINT "fk_patient_consumptions_templateId" FOREIGN KEY ("templateId") REFERENCES consumption_templates (id) ON DELETE SET NULL,
  CONSTRAINT "fk_patient_consumptions_performedBy" FOREIGN KEY ("performedBy") REFERENCES employees (id)
);
CREATE INDEX "idx_patient_consumptions_appointmentId" ON patient_consumptions ("appointmentId");
CREATE INDEX "idx_patient_consumptions_patientId" ON patient_consumptions ("patientId");
CREATE INDEX "idx_patient_consumptions_organizationId_locationId_createdAt" ON patient_consumptions ("organizationId", "locationId", "createdAt");

-- ------------------------------------------------------------------------
-- purchase_orders   (src/inventory/entities/purchase-order.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE purchase_orders_status_enum AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TABLE purchase_orders (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "poNumber"             varchar NOT NULL,
  "organizationId"       uuid NOT NULL,
  "locationId"           uuid NOT NULL,
  "supplierId"           uuid NOT NULL,
  "createdBy"            uuid NOT NULL,
  status                 purchase_orders_status_enum NOT NULL DEFAULT 'DRAFT',
  subtotal               numeric(10,2) NOT NULL DEFAULT 0,
  "taxRate"              numeric(5,2) NOT NULL DEFAULT 0,
  "taxAmount"            numeric(10,2) NOT NULL DEFAULT 0,
  "totalAmount"          numeric(10,2) NOT NULL DEFAULT 0,
  "orderDate"            date,
  "expectedDeliveryDate" date,
  "receivedDate"         date,
  notes                  text,
  "createdAt"            timestamptz NOT NULL DEFAULT now(),
  "updatedAt"            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_purchase_orders_poNumber" UNIQUE ("poNumber"),
  CONSTRAINT "fk_purchase_orders_organizationId" FOREIGN KEY ("organizationId") REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT "fk_purchase_orders_locationId" FOREIGN KEY ("locationId") REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT "fk_purchase_orders_supplierId" FOREIGN KEY ("supplierId") REFERENCES suppliers (id),
  CONSTRAINT "fk_purchase_orders_createdBy" FOREIGN KEY ("createdBy") REFERENCES employees (id)
);
CREATE UNIQUE INDEX "idx_purchase_orders_poNumber" ON purchase_orders ("poNumber");
CREATE INDEX "idx_purchase_orders_supplierId" ON purchase_orders ("supplierId");
CREATE INDEX "idx_purchase_orders_organizationId_locationId_status" ON purchase_orders ("organizationId", "locationId", status);

-- ------------------------------------------------------------------------
-- lab_invoice_lines   (src/lab-billing/entities/lab-invoice.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_invoice_lines_line_kind_enum AS ENUM ('lab_item', 'lab_charge', 'manual');
CREATE TABLE lab_invoice_lines (
  id                       uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id          uuid NOT NULL,
  invoice_id               uuid NOT NULL,
  line_no                  integer NOT NULL,
  line_kind                lab_invoice_lines_line_kind_enum NOT NULL,
  lab_order_item_id        uuid,
  order_charge_request_id  uuid,
  clinic_treatment_id      uuid,
  doctor_id                uuid,
  performing_assignment_id uuid,
  commission_plan_id       uuid,
  commission_rate_bps      integer,
  commission_fixed_minor   bigint,
  description              varchar(200) NOT NULL,
  quantity                 integer NOT NULL DEFAULT 1,
  unit_price_minor         bigint NOT NULL DEFAULT 0,
  discount_minor           bigint NOT NULL DEFAULT 0,
  tax_rate_bp              integer NOT NULL DEFAULT 0,
  tax_minor                bigint NOT NULL DEFAULT 0,
  line_total_minor         bigint NOT NULL DEFAULT 0,
  is_void                  boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lab_invoice_lines_no UNIQUE (invoice_id, line_no),
  CONSTRAINT chk_lab_invoice_lines_math CHECK ("quantity" > 0 AND "unit_price_minor" >= 0 AND "discount_minor" >= 0 AND "discount_minor" <= "quantity" * "unit_price_minor" AND "tax_rate_bp" BETWEEN 0 AND 10000 AND "tax_minor" >= 0 AND "line_total_minor" = "quantity" * "unit_price_minor" - "discount_minor" + "tax_minor"),
  CONSTRAINT fk_lab_invoice_lines_invoice_id FOREIGN KEY (invoice_id) REFERENCES lab_invoices (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_invoice_lines_lab_order_item_id FOREIGN KEY (lab_order_item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_invoice_lines_order_charge_request_id FOREIGN KEY (order_charge_request_id) REFERENCES order_charge_requests (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_lab_invoice_lines_charge ON lab_invoice_lines (order_charge_request_id) WHERE "order_charge_request_id" IS NOT NULL AND NOT "is_void";
CREATE UNIQUE INDEX uq_lab_invoice_lines_item ON lab_invoice_lines (lab_order_item_id) WHERE "lab_order_item_id" IS NOT NULL AND NOT "is_void";

-- ------------------------------------------------------------------------
-- lab_refunds   (src/lab-billing/entities/lab-credit.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_refunds_method_enum AS ENUM ('cash', 'card', 'bank_transfer', 'wallet');
CREATE TABLE lab_refunds (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  refund_no       varchar(30) NOT NULL,
  patient_id      uuid NOT NULL,
  credit_note_id  uuid,
  amount_minor    bigint NOT NULL DEFAULT 0,
  method          lab_refunds_method_enum NOT NULL,
  reference       varchar(80),
  reason          text NOT NULL,
  refunded_at     timestamptz NOT NULL,
  refunded_by     uuid NOT NULL,
  idempotency_key varchar(150) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_lab_refunds_org_idempotency UNIQUE (organization_id, idempotency_key),
  CONSTRAINT uq_lab_refunds_org_no UNIQUE (organization_id, refund_no),
  CONSTRAINT chk_lab_refunds_amount CHECK ("amount_minor" > 0),
  CONSTRAINT fk_lab_refunds_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_refunds_credit_note_id FOREIGN KEY (credit_note_id) REFERENCES lab_credit_notes (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_refunds_credit_note ON lab_refunds (credit_note_id);
CREATE INDEX idx_lab_refunds_patient ON lab_refunds (organization_id, patient_id);

-- ------------------------------------------------------------------------
-- lab_statements   (src/lab-payables/entities/lab-statement.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_statements_status_enum AS ENUM ('uploaded', 'reconciling', 'reconciled', 'disputed');
CREATE TABLE lab_statements (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  lab_id          uuid NOT NULL,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  statement_ref   varchar(60),
  total_minor     bigint NOT NULL DEFAULT 0,
  attachment_id   uuid,
  status          lab_statements_status_enum NOT NULL DEFAULT 'uploaded',
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_lab_statements_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_statements_lab ON lab_statements (organization_id, lab_id, period_start);

-- ------------------------------------------------------------------------
-- vendor_payments   (src/lab-payables/entities/vendor-payment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE vendor_payments_method_enum AS ENUM ('cash', 'bank_transfer', 'cheque', 'other');
CREATE TYPE vendor_payments_status_enum AS ENUM ('posted', 'reversed');
CREATE TABLE vendor_payments (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  lab_id          uuid NOT NULL,
  payment_no      varchar(30) NOT NULL,
  amount_minor    bigint NOT NULL DEFAULT 0,
  allocated_minor bigint NOT NULL DEFAULT 0,
  method          vendor_payments_method_enum NOT NULL,
  reference       varchar(100),
  paid_on         date NOT NULL,
  paid_at         timestamptz NOT NULL,
  status          vendor_payments_status_enum NOT NULL DEFAULT 'posted',
  reversed_at     timestamptz,
  reversed_by     uuid,
  reversal_reason text,
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_vendor_payments_minor CHECK ("amount_minor" > 0 AND "allocated_minor" >= 0 AND "allocated_minor" <= "amount_minor"),
  CONSTRAINT fk_vendor_payments_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT
);
CREATE INDEX idx_vendor_payments_lab ON vendor_payments (organization_id, lab_id, paid_at);
CREATE UNIQUE INDEX uq_vendor_payments_no ON vendor_payments (organization_id, payment_no);

-- ------------------------------------------------------------------------
-- order_item_stages   (src/lab-production/entities/order-item-stage.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE order_item_stages_outcome_enum AS ENUM ('approved', 'correction', 'rejected');
CREATE TABLE order_item_stages (
  id                           uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id              uuid NOT NULL,
  lab_id                       uuid NOT NULL,
  order_id                     uuid NOT NULL,
  item_id                      uuid NOT NULL,
  stage_template_step_id       uuid,
  workflow_template_version_id uuid NOT NULL,
  seq                          integer NOT NULL,
  round_no                     integer NOT NULL DEFAULT 1,
  code_snap                    varchar(50) NOT NULL,
  name_snap                    varchar(100) NOT NULL,
  is_final                     boolean NOT NULL DEFAULT false,
  requires_patient_visit       boolean NOT NULL DEFAULT true,
  status_code                  varchar(50) NOT NULL,
  is_active                    boolean NOT NULL DEFAULT false,
  lab_expected_on              date,
  appointment_id               uuid,
  outcome                      order_item_stages_outcome_enum,
  tryin_notes                  text,
  correction_notes             text,
  decided_by                   uuid,
  decided_at                   timestamptz,
  started_at                   timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  version                      integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_order_item_stages_round UNIQUE (item_id, seq, round_no),
  CONSTRAINT chk_order_item_stages_round CHECK ("round_no" > 0 AND "seq" > 0),
  CONSTRAINT fk_order_item_stages_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_item_stages_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_item_stages_stage_template_step_id FOREIGN KEY (stage_template_step_id) REFERENCES stage_template_steps (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_item_stages_workflow_template_version_id FOREIGN KEY (workflow_template_version_id) REFERENCES workflow_template_versions (id) ON DELETE RESTRICT
);
CREATE INDEX idx_order_item_stages_lab_status ON order_item_stages (lab_id, status_code);
CREATE INDEX idx_order_item_stages_order ON order_item_stages (order_id);
CREATE UNIQUE INDEX uq_order_item_stages_one_active ON order_item_stages (item_id) WHERE "is_active";

-- ------------------------------------------------------------------------
-- shipments   (src/lab-production/entities/production-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE shipments_direction_enum AS ENUM ('to_lab', 'to_clinic');
CREATE TYPE shipments_status_enum AS ENUM ('dispatched', 'partially_received', 'received', 'lost');
CREATE TABLE shipments (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  lab_id          uuid NOT NULL,
  shipment_no     varchar(30) NOT NULL,
  direction       shipments_direction_enum NOT NULL,
  status          shipments_status_enum NOT NULL DEFAULT 'dispatched',
  courier_name    varchar(100),
  tracking_no     varchar(100),
  notes           text,
  dispatched_at   timestamptz NOT NULL,
  dispatched_by   uuid,
  received_at     timestamptz,
  received_by     uuid,
  lost_at         timestamptz,
  lost_reason     text,
  qr_token        varchar(64) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_shipments_qr_token UNIQUE (qr_token),
  CONSTRAINT uq_shipments_org_no UNIQUE (organization_id, shipment_no)
);
CREATE INDEX idx_shipments_org_status ON shipments (organization_id, status, dispatched_at);
CREATE INDEX idx_shipments_lab_status ON shipments (lab_id, status, dispatched_at);

-- ------------------------------------------------------------------------
-- lab_members   (src/labs/entities/lab-member.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_members_role_enum AS ENUM ('lab_admin', 'lab_technician');
CREATE TABLE lab_members (
  id         uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  lab_id     uuid NOT NULL,
  user_id    uuid NOT NULL,
  role       lab_members_role_enum NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  version    integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_members_lab_user UNIQUE (lab_id, user_id),
  CONSTRAINT fk_lab_members_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_members_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_members_user ON lab_members (user_id);

-- ------------------------------------------------------------------------
-- user_devices   (src/devices/entities/user-device.entity.ts)
-- Push targets of a signed-in clinic user (Expo push tokens). Global, not
-- org-scoped: the same phone gets the user's alerts at every clinic; a token
-- moves to the newest user who registered it (uq_user_devices_token).
-- ------------------------------------------------------------------------
CREATE TABLE user_devices (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL,
  expo_push_token varchar(200) NOT NULL,
  platform        varchar(10) NOT NULL,
  device_label    varchar(80),
  app_version     varchar(20),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_devices_platform CHECK ("platform" IN ('android', 'ios')),
  CONSTRAINT fk_user_devices_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_user_devices_token ON user_devices (expo_push_token);
CREATE INDEX idx_user_devices_user_id ON user_devices (user_id);

-- ------------------------------------------------------------------------
-- notification_outbox   (src/notifications/entities/notification-outbox.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE notification_outbox (
  id                  uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id     uuid NOT NULL,
  location_id         uuid,
  event_code          text NOT NULL,
  audience            text NOT NULL,
  recipient_type      text NOT NULL,
  recipient_id        uuid NOT NULL,
  channel             text NOT NULL,
  entity_type         text,
  entity_id           uuid,
  payload             jsonb NOT NULL,
  status              text NOT NULL,
  scheduled_for       timestamptz NOT NULL DEFAULT now(),
  attempts            integer NOT NULL DEFAULT 0,
  provider_message_id text,
  last_error          text,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_notification_outbox_channel CHECK ("channel" IN ('in_app', 'whatsapp', 'sms', 'email', 'push')),
  CONSTRAINT chk_notification_outbox_audience CHECK ("audience" IN ('patient', 'doctor', 'coordinator', 'lab', 'staff')),
  CONSTRAINT chk_notification_outbox_status CHECK ("status" IN ('queued', 'held_quiet_hours', 'sent', 'delivered', 'failed', 'skipped_disabled', 'skipped_opt_out', 'skipped_unverified', 'skipped_no_device')),
  CONSTRAINT fk_notification_outbox_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_notification_outbox_event_code FOREIGN KEY (event_code) REFERENCES notification_events (code) ON DELETE RESTRICT
);
CREATE INDEX idx_notification_outbox_entity ON notification_outbox (entity_type, entity_id);
CREATE INDEX idx_notification_outbox_org_created ON notification_outbox (organization_id, created_at);
CREATE INDEX idx_notification_outbox_pending ON notification_outbox (status, scheduled_for) WHERE "status" IN ('queued', 'held_quiet_hours');

-- ------------------------------------------------------------------------
-- notification_templates   (src/notifications/entities/notification-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE notification_templates (
  id                    uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id       uuid,
  event_code            text NOT NULL,
  channel               text NOT NULL,
  language              text NOT NULL,
  subject               text,
  body                  text NOT NULL,
  variables             text[] NOT NULL DEFAULT '{}',
  provider_template_ref text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_by            uuid,
  version               integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_notification_templates_language CHECK ("language" IN ('en', 'ur', 'roman_ur')),
  CONSTRAINT chk_notification_templates_channel CHECK ("channel" IN ('in_app', 'whatsapp', 'sms', 'email', 'push')),
  CONSTRAINT fk_notification_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_templates_event_code FOREIGN KEY (event_code) REFERENCES notification_events (code) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_notification_templates_org ON notification_templates (organization_id, event_code, channel, language) WHERE "organization_id" IS NOT NULL;
CREATE UNIQUE INDEX uq_notification_templates_platform ON notification_templates (event_code, channel, language) WHERE "organization_id" IS NULL;

-- ------------------------------------------------------------------------
-- patient_treatment_plans   (src/patients/entities/patient-treatment-plan.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_treatment_plans_status_enum AS ENUM ('draft', 'active', 'completed', 'cancelled', 'on_hold');
CREATE TYPE plan_discount_kind_enum AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TABLE patient_treatment_plans (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id           uuid NOT NULL,
  location_id          uuid NOT NULL,
  dentist_id           uuid NOT NULL,
  organization_id      uuid NOT NULL,
  plan_number          varchar(20) NOT NULL,
  plan_name            varchar(200) NOT NULL,
  description          text,
  estimated_cost       numeric(12,2),
  discount_amount      numeric(12,2) NOT NULL DEFAULT 0,
  final_estimated_cost numeric(12,2),
  status               patient_treatment_plans_status_enum NOT NULL DEFAULT 'draft',
  start_date           date,
  expected_end_date    date,
  actual_end_date      date,
  patient_accepted     boolean NOT NULL DEFAULT false,
  patient_accepted_at  timestamptz,
  notes                text,
  encounter_id         uuid,
  plan_template_id     uuid,
  discount_kind        plan_discount_kind_enum,
  discount_value       numeric(12,2),
  invoice_id           uuid,
  started_at           timestamptz,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT fk_patient_treatment_plans_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_treatment_plans_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_treatment_plans_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_treatment_plans_dentist_id ON patient_treatment_plans (dentist_id);
CREATE INDEX idx_patient_treatment_plans_status ON patient_treatment_plans (status);
CREATE INDEX idx_patient_treatment_plans_organization_id ON patient_treatment_plans (organization_id);
CREATE INDEX idx_patient_treatment_plans_patient_id ON patient_treatment_plans (patient_id);
CREATE UNIQUE INDEX idx_patient_treatment_plans_organization_id_plan_number ON patient_treatment_plans (organization_id, plan_number);

-- ------------------------------------------------------------------------
-- plan_templates   (src/plan-templates/entities/plan-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE plan_templates_category_enum AS ENUM ('GENERAL', 'PREVENTIVE', 'RESTORATIVE', 'ENDODONTICS', 'PERIODONTICS', 'ORAL_SURGERY', 'PROSTHODONTICS', 'IMPLANTOLOGY', 'ORTHODONTICS', 'PEDIATRIC', 'COSMETIC', 'GERIATRIC', 'ORAL_MEDICINE', 'TMJ_AND_OROFACIAL_PAIN', 'FULL_MOUTH_REHABILITATION', 'EMERGENCY', 'OTHER');
CREATE TABLE plan_templates (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  name            varchar(200) NOT NULL,
  category        plan_templates_category_enum NOT NULL DEFAULT 'GENERAL',
  description     text,
  items           jsonb NOT NULL DEFAULT '[]',
  discount_kind   plan_discount_kind_enum,
  discount_value  numeric(12,2),
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_templates_organization_id ON plan_templates (organization_id);

-- ------------------------------------------------------------------------
-- nav_layouts   (src/access/nav/nav-layout.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE nav_layouts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  role_id         uuid,
  layout          jsonb NOT NULL,
  version         integer NOT NULL DEFAULT 1,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_nav_layouts_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_nav_layouts_role_id FOREIGN KEY (role_id) REFERENCES employment_roles (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_nav_layouts_org_default ON nav_layouts (organization_id) WHERE "role_id" IS NULL;
CREATE UNIQUE INDEX uq_nav_layouts_org_role ON nav_layouts (organization_id, role_id);

-- ------------------------------------------------------------------------
-- oauth_providers   (src/auth/entities/OAuthProvider.ts)
-- ------------------------------------------------------------------------
CREATE TYPE oauth_providers_provider_enum AS ENUM ('google', 'local');
CREATE TABLE oauth_providers (
  uuid         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL,
  provider     oauth_providers_provider_enum NOT NULL,
  provider_id  varchar(255) NOT NULL,
  email        varchar(255),
  display_name varchar(255),
  avatar_url   varchar(500),
  profile_data jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_oauth_providers_user_id_provider UNIQUE (user_id, provider),
  CONSTRAINT fk_oauth_providers_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_oauth_providers_provider_provider_id ON oauth_providers (provider, provider_id);

-- ------------------------------------------------------------------------
-- security_logs   (src/auth/entities/SecurityLog.ts)
-- ------------------------------------------------------------------------
CREATE TYPE security_logs_event_type_enum AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'LOGOUT_ALL', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'EMAIL_VERIFICATION_SENT', 'EMAIL_VERIFIED', 'EMAIL_VERIFIED_BY_ADMIN', 'SESSION_CREATED', 'SESSION_REVOKED', 'SESSION_EXPIRED', 'TOKEN_REFRESHED', 'OAUTH_LINK', 'OAUTH_UNLINK', 'ACCOUNT_SUSPENDED', 'ACCOUNT_DELETED', 'ACCOUNT_RESTORED', 'NEW_DEVICE_LOGIN', 'SUSPICIOUS_ACTIVITY');
CREATE TABLE security_logs (
  uuid          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid,
  event_type    security_logs_event_type_enum NOT NULL,
  ip_address    varchar(45),
  user_agent    text,
  metadata      jsonb NOT NULL DEFAULT '{}',
  session_id    uuid,
  success       boolean NOT NULL DEFAULT true,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_security_logs_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE SET NULL
);
CREATE INDEX idx_security_logs_created_at ON security_logs (created_at);
CREATE INDEX idx_security_logs_user_id_event_type ON security_logs (user_id, event_type);

-- ------------------------------------------------------------------------
-- billing_audit_logs   (src/billing/entities/billing-audit-log.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE billing_audit_logs_entity_type_enum AS ENUM ('CHARGE', 'INVOICE', 'PAYMENT', 'REFUND', 'DISCOUNT_TYPE', 'SERVICE', 'SERVICE_PRICE', 'SETTINGS', 'PAYMENT_ACCOUNT', 'CASH_CLOSE');
CREATE TYPE billing_audit_logs_action_enum AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'VOIDED', 'DISCOUNT_APPLIED', 'DISCOUNT_REMOVED', 'PRICE_CHANGED', 'ISSUED', 'EDITED', 'CANCELLED', 'ALLOCATED', 'UNAPPLIED', 'REFUNDED', 'CLOSED');
CREATE TABLE billing_audit_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid,
  entity_type     billing_audit_logs_entity_type_enum NOT NULL,
  entity_id       uuid NOT NULL,
  action          billing_audit_logs_action_enum NOT NULL,
  before          jsonb,
  after           jsonb,
  amount          numeric(12,2),
  reason          varchar(300),
  actor_id        uuid NOT NULL,
  actor_role      varchar(30) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_audit_entity ON billing_audit_logs (entity_type, entity_id);
CREATE INDEX idx_billing_audit_org_loc_created ON billing_audit_logs (organization_id, location_id, created_at);

-- ------------------------------------------------------------------------
-- cash_close_lines   (src/billing/entities/cash-close.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE cash_close_lines (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_close_id        uuid NOT NULL,
  payment_account_id   uuid NOT NULL,
  payment_account_name varchar(60) NOT NULL,
  payments_total       numeric(12,2) NOT NULL DEFAULT 0,
  refunds_total        numeric(12,2) NOT NULL DEFAULT 0,
  payment_count        integer NOT NULL DEFAULT 0,
  refund_count         integer NOT NULL DEFAULT 0,
  expected             numeric(12,2) NOT NULL,
  counted              numeric(12,2),
  variance             numeric(12,2) NOT NULL,
  CONSTRAINT fk_cash_close_lines_cash_close_id FOREIGN KEY (cash_close_id) REFERENCES cash_closes (id) ON DELETE RESTRICT
);
CREATE INDEX idx_cash_close_lines_close ON cash_close_lines (cash_close_id);

-- ------------------------------------------------------------------------
-- commission_entries   (src/billing/commissions/entities/commission-entry.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE commission_entries_source_type_enum AS ENUM ('ALLOCATION', 'UNAPPLY', 'CHARGE_ADJUST', 'VOID', 'MANUAL');
CREATE TABLE commission_entries (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id     uuid NOT NULL,
  location_id         uuid NOT NULL,
  assignment_id       uuid NOT NULL,
  charge_id           uuid,
  lab_invoice_line_id uuid,
  source_type         commission_entries_source_type_enum NOT NULL,
  source_id           uuid NOT NULL,
  base_minor          bigint NOT NULL DEFAULT 0,
  rate_bps            integer,
  amount_minor        bigint NOT NULL DEFAULT 0,
  settlement_id       uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_commission_entries_target CHECK (("charge_id" IS NULL) <> ("lab_invoice_line_id" IS NULL)),
  CONSTRAINT fk_commission_entries_assignment_id FOREIGN KEY (assignment_id) REFERENCES employee_org_location_assignments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_commission_entries_charge_id FOREIGN KEY (charge_id) REFERENCES charges (id) ON DELETE RESTRICT,
  CONSTRAINT fk_commission_entries_lab_invoice_line_id FOREIGN KEY (lab_invoice_line_id) REFERENCES lab_invoice_lines (id) ON DELETE RESTRICT,
  CONSTRAINT fk_commission_entries_settlement_id FOREIGN KEY (settlement_id) REFERENCES commission_settlements (id) ON DELETE RESTRICT
);
CREATE INDEX idx_commission_entries_charge ON commission_entries (charge_id);
CREATE INDEX idx_commission_entries_unsettled ON commission_entries (assignment_id) WHERE "settlement_id" IS NULL;
CREATE INDEX idx_commission_entries_assignment ON commission_entries (assignment_id, created_at);
CREATE INDEX idx_commission_entries_lab_line ON commission_entries (lab_invoice_line_id);
CREATE UNIQUE INDEX uq_commission_entries_lab_source ON commission_entries (source_type, source_id, lab_invoice_line_id) WHERE "lab_invoice_line_id" IS NOT NULL;
CREATE UNIQUE INDEX uq_commission_entries_source ON commission_entries (source_type, source_id, charge_id);

-- ------------------------------------------------------------------------
-- commission_rules   (src/billing/commissions/entities/commission-rule.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE commission_rules_service_category_enum AS ENUM ('CONSULTATION', 'PROCEDURE', 'OTHER');
CREATE TABLE commission_rules (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id            uuid NOT NULL,
  service_id         uuid,
  service_category   commission_rules_service_category_enum,
  rate_bps           integer,
  fixed_amount_minor bigint,
  CONSTRAINT chk_commission_rules_target CHECK (("service_id" IS NULL) <> ("service_category" IS NULL)),
  CONSTRAINT chk_commission_rules_fixed CHECK ("fixed_amount_minor" IS NULL OR "fixed_amount_minor" >= 0),
  CONSTRAINT chk_commission_rules_rate CHECK ("rate_bps" IS NULL OR "rate_bps" BETWEEN 0 AND 10000),
  CONSTRAINT chk_commission_rules_amount CHECK (("rate_bps" IS NULL) <> ("fixed_amount_minor" IS NULL)),
  CONSTRAINT fk_commission_rules_plan_id FOREIGN KEY (plan_id) REFERENCES compensation_plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_commission_rules_service_id FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_commission_rules_category ON commission_rules (plan_id, service_category) WHERE "service_category" IS NOT NULL;
CREATE UNIQUE INDEX uq_commission_rules_service ON commission_rules (plan_id, service_id) WHERE "service_id" IS NOT NULL;

-- ------------------------------------------------------------------------
-- discount_types   (src/billing/entities/discount-type.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE discount_types_kind_enum AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE discount_types_applies_to_enum AS ENUM ('ALL', 'SERVICE_KINDS', 'SERVICES');
CREATE TYPE discount_types_service_kinds_enum AS ENUM ('CONSULTATION', 'PROCEDURE', 'OTHER');
CREATE TABLE discount_types (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id    uuid NOT NULL,
  name               varchar(80) NOT NULL,
  code               varchar(30),
  kind               discount_types_kind_enum NOT NULL,
  value              numeric(12,2) NOT NULL,
  max_amount         numeric(12,2),
  applies_to         discount_types_applies_to_enum NOT NULL DEFAULT 'ALL',
  service_kinds      discount_types_service_kinds_enum[],
  service_ids        uuid[],
  reception_editable boolean NOT NULL DEFAULT false,
  min_value          numeric(12,2),
  max_value          numeric(12,2),
  requires_note      boolean NOT NULL DEFAULT false,
  valid_from         date,
  valid_to           date,
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_discount_types_org_code ON discount_types (organization_id, code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX uq_discount_types_org_name ON discount_types (organization_id, name);

-- ------------------------------------------------------------------------
-- document_sequences   (src/billing/entities/document-sequence.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE document_sequences_doc_type_enum AS ENUM ('INVOICE', 'RECEIPT', 'REFUND');
CREATE TABLE document_sequences (
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  doc_type        document_sequences_doc_type_enum NOT NULL,
  year            integer NOT NULL,
  last_value      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, location_id, doc_type, year)
);

-- ------------------------------------------------------------------------
-- expenses   (src/billing/entities/expense.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE expenses_category_enum AS ENUM ('RENT', 'UTILITIES', 'SUPPLIES', 'SALARY', 'EQUIPMENT', 'MARKETING', 'MAINTENANCE', 'OTHER');
CREATE TYPE expenses_payment_method_enum AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'INSURANCE', 'CHEQUE', 'CREDIT_PACKAGE');
CREATE TABLE expenses (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  uuid NOT NULL,
  location_id      uuid NOT NULL,
  category         expenses_category_enum NOT NULL,
  description      varchar(300) NOT NULL,
  amount           numeric(10,2) NOT NULL,
  expense_date     date NOT NULL,
  payment_method   expenses_payment_method_enum NOT NULL,
  reference_number varchar(100),
  receipt_url      text,
  recorded_by      uuid,
  notes            text,
  lab_id           uuid,
  lab_order_id     uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_expenses_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_recorded_by FOREIGN KEY (recorded_by) REFERENCES employees (id) ON DELETE SET NULL
);
CREATE INDEX idx_expenses_lab_order ON expenses (lab_order_id);
CREATE INDEX idx_expenses_organization_id_category ON expenses (organization_id, category);
CREATE INDEX idx_expenses_organization_id_location_id_expense_date ON expenses (organization_id, location_id, expense_date);

-- ------------------------------------------------------------------------
-- ledger_entries   (src/billing/entities/ledger-entry.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE ledger_entries_type_enum AS ENUM ('INVOICE_ISSUED', 'INVOICE_ADJUSTED', 'INVOICE_CANCELLED', 'PAYMENT', 'REFUND');
CREATE TABLE ledger_entries (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  uuid NOT NULL,
  location_id      uuid NOT NULL,
  patient_id       uuid NOT NULL,
  type             ledger_entries_type_enum NOT NULL,
  entry_date       date NOT NULL,
  debit            numeric(12,2) NOT NULL DEFAULT 0,
  credit           numeric(12,2) NOT NULL DEFAULT 0,
  invoice_id       uuid,
  payment_id       uuid,
  refund_id        uuid,
  invoice_revision integer,
  description      varchar(200) NOT NULL,
  created_by       uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_patient ON ledger_entries (organization_id, location_id, patient_id, entry_date, created_at);

-- ------------------------------------------------------------------------
-- ledger_journal_lines   (src/billing/ledger/journal/ledger-journal.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE ledger_journal_lines (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  journal_id      uuid NOT NULL,
  organization_id uuid NOT NULL,
  location_id     uuid,
  account_code    varchar(40) NOT NULL,
  debit_minor     bigint NOT NULL DEFAULT 0,
  credit_minor    bigint NOT NULL DEFAULT 0,
  patient_id      uuid,
  lab_id          uuid,
  doctor_id       uuid,
  lab_order_id    uuid,
  CONSTRAINT chk_ledger_journal_lines_side CHECK (("debit_minor" > 0 AND "credit_minor" = 0) OR ("credit_minor" > 0 AND "debit_minor" = 0)),
  CONSTRAINT fk_ledger_journal_lines_journal_id FOREIGN KEY (journal_id) REFERENCES ledger_journals (id) ON DELETE RESTRICT
);
CREATE INDEX idx_ledger_journal_lines_lab ON ledger_journal_lines (lab_id);
CREATE INDEX idx_ledger_journal_lines_account ON ledger_journal_lines (organization_id, account_code);
CREATE INDEX idx_ledger_journal_lines_journal ON ledger_journal_lines (journal_id);

-- ------------------------------------------------------------------------
-- location_billing_settings   (src/billing/entities/location-billing-settings.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE location_billing_settings_invoice_print_format_enum AS ENUM ('A4', 'THERMAL_80');
CREATE TYPE location_billing_settings_receipt_print_format_enum AS ENUM ('A4', 'THERMAL_80');
CREATE TABLE location_billing_settings (
  location_id                     uuid PRIMARY KEY,
  organization_id                 uuid NOT NULL,
  document_code                   varchar(6),
  due_days                        integer NOT NULL DEFAULT 7,
  invoice_print_format            location_billing_settings_invoice_print_format_enum NOT NULL DEFAULT 'A4',
  receipt_print_format            location_billing_settings_receipt_print_format_enum NOT NULL DEFAULT 'A4',
  show_logo                       boolean NOT NULL DEFAULT true,
  show_previous_balance           boolean NOT NULL DEFAULT true,
  show_outstanding_at_check_in    boolean NOT NULL DEFAULT true,
  footer_note                     varchar(300),
  default_consultation_service_id uuid,
  default_payment_account_id      uuid,
  cash_variance_alert_amount      numeric(12,2) NOT NULL DEFAULT 0,
  updated_by                      uuid,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- patient_credits   (src/billing/entities/patient-credit.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_credits_status_enum AS ENUM ('ACTIVE', 'EXPIRED', 'EXHAUSTED');
CREATE TABLE patient_credits (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id        uuid NOT NULL,
  organization_id   uuid NOT NULL,
  credit_package_id uuid,
  purchased_by      uuid,
  total_amount      numeric(10,2) NOT NULL,
  used_amount       numeric(10,2) NOT NULL DEFAULT 0,
  remaining_amount  numeric(10,2) NOT NULL,
  purchase_date     date NOT NULL,
  expiry_date       date,
  status            patient_credits_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_credits_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_credits_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_credits_credit_package_id FOREIGN KEY (credit_package_id) REFERENCES credit_packages (id) ON DELETE SET NULL,
  CONSTRAINT fk_patient_credits_purchased_by FOREIGN KEY (purchased_by) REFERENCES employees (id) ON DELETE SET NULL
);
CREATE INDEX idx_patient_credits_patient_id_organization_id_status ON patient_credits (patient_id, organization_id, status);

-- ------------------------------------------------------------------------
-- payment_allocations   (src/billing/entities/payment-allocation.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE payment_allocations_reason_enum AS ENUM ('PAYMENT', 'ADVANCE_APPLIED', 'INVOICE_EDIT_RELEASE', 'UNAPPLY');
CREATE TABLE payment_allocations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  patient_id      uuid NOT NULL,
  payment_id      uuid NOT NULL,
  charge_id       uuid NOT NULL,
  invoice_id      uuid NOT NULL,
  amount          numeric(12,2) NOT NULL,
  reason          payment_allocations_reason_enum NOT NULL,
  note            varchar(300),
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_allocations_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT fk_payment_allocations_payment_id FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_allocations_charge_id FOREIGN KEY (charge_id) REFERENCES charges (id) ON DELETE RESTRICT
);
CREATE INDEX idx_payment_allocations_invoice ON payment_allocations (invoice_id);
CREATE INDEX idx_payment_allocations_charge ON payment_allocations (charge_id);
CREATE INDEX idx_payment_allocations_payment ON payment_allocations (payment_id);

-- ------------------------------------------------------------------------
-- refund_sources   (src/billing/entities/refund-source.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE refund_sources (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  refund_id       uuid NOT NULL,
  payment_id      uuid NOT NULL,
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_refund_sources_refund_id FOREIGN KEY (refund_id) REFERENCES refunds (id) ON DELETE RESTRICT,
  CONSTRAINT fk_refund_sources_payment_id FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT
);
CREATE INDEX idx_refund_sources_payment ON refund_sources (payment_id);
CREATE INDEX idx_refund_sources_refund ON refund_sources (refund_id);

-- ------------------------------------------------------------------------
-- service_prices   (src/billing/entities/service-price.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE service_prices (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  service_id      uuid NOT NULL,
  doctor_id       uuid,
  price           numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_service_prices_service_id FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT,
  CONSTRAINT fk_service_prices_doctor_id FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_service_prices_loc_doc ON service_prices (service_id, location_id, doctor_id) WHERE doctor_id IS NOT NULL;
CREATE UNIQUE INDEX uq_service_prices_loc ON service_prices (service_id, location_id) WHERE doctor_id IS NULL;

-- ------------------------------------------------------------------------
-- clinic_invites   (src/clinic-access/entities/clinic-invite.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE clinic_invites (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  token           varchar(64) NOT NULL,
  created_by      uuid,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  uses            integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_invites_organization_id ON clinic_invites (organization_id);
CREATE UNIQUE INDEX idx_clinic_invites_token ON clinic_invites (token);

-- ------------------------------------------------------------------------
-- clinic_join_requests   (src/clinic-access/entities/clinic-join-request.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE clinic_join_requests_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TABLE clinic_join_requests (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id         uuid NOT NULL,
  email           varchar(255) NOT NULL,
  name            varchar(255) NOT NULL,
  phone           varchar(20) NOT NULL,
  message         varchar(500),
  status          clinic_join_requests_status_enum NOT NULL DEFAULT 'pending',
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   varchar(500),
  employee_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_join_requests_user_id ON clinic_join_requests (user_id);
CREATE INDEX idx_clinic_join_requests_organization_id_status ON clinic_join_requests (organization_id, status);

-- ------------------------------------------------------------------------
-- audit_logs   (src/common/audit/entities/audit-log.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE audit_logs_action_enum AS ENUM ('create', 'update', 'void', 'delete', 'export', 'view_sensitive');
CREATE TYPE audit_logs_actor_side_enum AS ENUM ('clinic', 'lab', 'platform', 'system');
CREATE TABLE audit_logs (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid,
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid NOT NULL,
  subject_id      uuid,
  action          audit_logs_action_enum NOT NULL,
  changes         jsonb,
  actor_user_id   uuid,
  actor_side      audit_logs_actor_side_enum NOT NULL,
  ip              inet,
  request_id      varchar(100),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_subject ON audit_logs (subject_id, created_at);
CREATE INDEX idx_audit_logs_org_created ON audit_logs (organization_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at);

-- ------------------------------------------------------------------------
-- email_log   (src/common/mail/email-log.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE email_log (
  id                  uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  to_address          text NOT NULL,
  kind                text NOT NULL,
  status              text NOT NULL,
  user_id             uuid,
  provider_message_id text,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_log_created ON email_log (created_at);

-- ------------------------------------------------------------------------
-- number_sequences   (src/common/sequences/number-sequence.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE number_sequences (
  organization_id uuid NOT NULL,
  sequence_key    varchar(30) NOT NULL,
  prefix          varchar(10) NOT NULL,
  next_value      bigint NOT NULL DEFAULT 1,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, sequence_key),
  CONSTRAINT chk_number_sequences_next_value CHECK ("next_value" > 0)
);

-- ------------------------------------------------------------------------
-- status_history   (src/common/audit/entities/status-history.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE status_history_actor_side_enum AS ENUM ('clinic', 'lab', 'platform', 'system');
CREATE TYPE status_history_via_enum AS ENUM ('app', 'portal', 'magic_link', 'proxy', 'qr');
CREATE TABLE status_history (
  id                  uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id     uuid NOT NULL,
  entity_type         varchar(50) NOT NULL,
  entity_id           uuid NOT NULL,
  subject_id          uuid,
  from_state          varchar(50),
  to_state            varchar(50) NOT NULL,
  action_code         varchar(50) NOT NULL,
  actor_user_id       uuid,
  actor_side          status_history_actor_side_enum NOT NULL,
  via                 status_history_via_enum NOT NULL DEFAULT 'app',
  on_behalf_of_lab_id uuid,
  reason              text,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_subject ON status_history (subject_id, created_at);
CREATE INDEX idx_status_history_entity ON status_history (entity_type, entity_id, created_at);

-- ------------------------------------------------------------------------
-- doctor_availability_overrides   (src/employees/entities/doctor-availability-override.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE doctor_availability_overrides (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id     uuid NOT NULL,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  date            date NOT NULL,
  is_available    boolean NOT NULL DEFAULT false,
  reason          text,
  override_hours  jsonb,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_doctor_availability_overrides_employee_id_location_id_date UNIQUE (employee_id, location_id, date),
  CONSTRAINT fk_doctor_availability_overrides_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_doctor_availability_overrides_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_doctor_availability_overrides_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);
CREATE INDEX idx_doctor_availability_overrides_location_id_date ON doctor_availability_overrides (location_id, date);
CREATE INDEX idx_doctor_availability_overrides_employee_id_date ON doctor_availability_overrides (employee_id, date);

-- ------------------------------------------------------------------------
-- employee_leaves   (src/employees/entities/employee-leave.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE employee_leaves_leave_type_enum AS ENUM ('annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other');
CREATE TYPE employee_leaves_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TABLE employee_leaves (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id     uuid NOT NULL,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  leave_type      employee_leaves_leave_type_enum NOT NULL DEFAULT 'annual',
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  total_days      integer NOT NULL DEFAULT 1,
  status          employee_leaves_status_enum NOT NULL DEFAULT 'pending',
  reason          text,
  review_note     text,
  approved_by     uuid,
  reviewed_at     timestamptz,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_employee_leaves_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_leaves_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_leaves_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);
CREATE INDEX idx_employee_leaves_start_date_end_date ON employee_leaves (start_date, end_date);
CREATE INDEX idx_employee_leaves_organization_id_location_id_status ON employee_leaves (organization_id, location_id, status);
CREATE INDEX idx_employee_leaves_employee_id_status ON employee_leaves (employee_id, status);

-- ------------------------------------------------------------------------
-- employee_schedules   (src/employees/entities/employee-schedule.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE employee_schedules (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id     uuid NOT NULL,
  location_id     uuid NOT NULL,
  organization_id uuid NOT NULL,
  day_of_week     integer NOT NULL,
  is_working      boolean NOT NULL DEFAULT true,
  start_time      time,
  end_time        time,
  slot_duration   integer NOT NULL DEFAULT 30,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_schedules_employee_id_location_id_day_of_week UNIQUE (employee_id, location_id, day_of_week),
  CONSTRAINT fk_employee_schedules_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_schedules_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_schedules_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_employee_schedules_location_id_day_of_week ON employee_schedules (location_id, day_of_week);
CREATE INDEX idx_employee_schedules_employee_id_location_id ON employee_schedules (employee_id, location_id);

-- ------------------------------------------------------------------------
-- organization_specialties   (src/engine/entities/organization-specialty.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE organization_specialties (
  organization_id uuid NOT NULL,
  specialty_id    uuid NOT NULL,
  is_enabled      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  PRIMARY KEY (organization_id, specialty_id),
  CONSTRAINT fk_organization_specialties_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_organization_specialties_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- transition_effects   (src/engine/entities/workflow-effect.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE transition_effects (
  transition_id uuid NOT NULL,
  effect_code   varchar(60) NOT NULL,
  seq           integer NOT NULL,
  params        jsonb,
  PRIMARY KEY (transition_id, effect_code),
  CONSTRAINT uq_transition_effects_seq UNIQUE (transition_id, seq),
  CONSTRAINT fk_transition_effects_transition_id FOREIGN KEY (transition_id) REFERENCES workflow_transitions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_transition_effects_effect_code FOREIGN KEY (effect_code) REFERENCES workflow_effects (code) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- feature_catalog   (src/feature-flags/entities/feature-catalog.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE feature_catalog (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key                varchar(100) NOT NULL,
  name               varchar(255) NOT NULL,
  module             varchar(100) NOT NULL,
  description        text,
  specialty_tags     jsonb NOT NULL DEFAULT '["general"]',
  enabled_by_default boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_feature_catalog_key UNIQUE (key)
);
CREATE INDEX idx_feature_catalog_is_active ON feature_catalog (is_active);
CREATE INDEX idx_feature_catalog_module ON feature_catalog (module);
CREATE UNIQUE INDEX idx_feature_catalog_key ON feature_catalog (key);

-- ------------------------------------------------------------------------
-- location_feature_overrides   (src/feature-flags/entities/location-feature-override.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE location_feature_overrides (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  location_id     uuid NOT NULL,
  feature_key     varchar(100) NOT NULL,
  is_disabled     boolean NOT NULL DEFAULT false,
  updated_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_location_feature_overrides_location_id_feature_key UNIQUE (location_id, feature_key),
  CONSTRAINT fk_location_feature_overrides_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);
CREATE INDEX idx_location_feature_overrides_organization_id_location_id ON location_feature_overrides (organization_id, location_id);

-- ------------------------------------------------------------------------
-- org_feature_flags   (src/feature-flags/entities/org-feature-flag.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE org_feature_flags (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  feature_key     varchar(100) NOT NULL,
  is_enabled      boolean NOT NULL DEFAULT false,
  enabled_by      uuid,
  is_entitled     boolean NOT NULL DEFAULT true,
  entitled_by     uuid,
  entitled_at     timestamptz,
  entitled_until  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_feature_flags_organization_id_feature_key UNIQUE (organization_id, feature_key),
  CONSTRAINT fk_org_feature_flags_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_org_feature_flags_organization_id_is_enabled ON org_feature_flags (organization_id, is_enabled);

-- ------------------------------------------------------------------------
-- consumption_template_items   (src/inventory/entities/consumption-template-item.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE consumption_template_items (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "templateId"      uuid NOT NULL,
  "inventoryItemId" uuid NOT NULL,
  quantity          numeric(10,2) NOT NULL,
  notes             varchar,
  "sortOrder"       integer NOT NULL DEFAULT 0,
  CONSTRAINT "fk_consumption_template_items_templateId" FOREIGN KEY ("templateId") REFERENCES consumption_templates (id) ON DELETE CASCADE,
  CONSTRAINT "fk_consumption_template_items_inventoryItemId" FOREIGN KEY ("inventoryItemId") REFERENCES inventory_items (id)
);
CREATE INDEX "idx_consumption_template_items_templateId" ON consumption_template_items ("templateId");

-- ------------------------------------------------------------------------
-- patient_consumption_items   (src/inventory/entities/patient-consumption-item.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_consumption_items (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "consumptionId"   uuid NOT NULL,
  "inventoryItemId" uuid NOT NULL,
  quantity          numeric(10,2) NOT NULL,
  "unitPrice"       numeric(10,2) NOT NULL,
  "totalPrice"      numeric(10,2) NOT NULL,
  "wasFromTemplate" boolean NOT NULL DEFAULT false,
  "sortOrder"       integer NOT NULL DEFAULT 0,
  CONSTRAINT "fk_patient_consumption_items_consumptionId" FOREIGN KEY ("consumptionId") REFERENCES patient_consumptions (id) ON DELETE CASCADE,
  CONSTRAINT "fk_patient_consumption_items_inventoryItemId" FOREIGN KEY ("inventoryItemId") REFERENCES inventory_items (id)
);
CREATE INDEX "idx_patient_consumption_items_consumptionId" ON patient_consumption_items ("consumptionId");

-- ------------------------------------------------------------------------
-- purchase_order_items   (src/inventory/entities/purchase-order-item.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE purchase_order_items (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "purchaseOrderId"  uuid NOT NULL,
  "inventoryItemId"  uuid NOT NULL,
  "orderedQuantity"  numeric(10,2) NOT NULL,
  "receivedQuantity" numeric(10,2) NOT NULL DEFAULT 0,
  "unitPrice"        numeric(10,2) NOT NULL,
  "totalPrice"       numeric(10,2) NOT NULL,
  "batchNumber"      varchar,
  "expiryDate"       date,
  notes              varchar,
  "sortOrder"        integer NOT NULL DEFAULT 0,
  CONSTRAINT "fk_purchase_order_items_purchaseOrderId" FOREIGN KEY ("purchaseOrderId") REFERENCES purchase_orders (id) ON DELETE CASCADE,
  CONSTRAINT "fk_purchase_order_items_inventoryItemId" FOREIGN KEY ("inventoryItemId") REFERENCES inventory_items (id)
);
CREATE INDEX "idx_purchase_order_items_purchaseOrderId" ON purchase_order_items ("purchaseOrderId");

-- ------------------------------------------------------------------------
-- stock_movements   (src/inventory/entities/stock-movement.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE stock_movements_movementtype_enum AS ENUM ('PURCHASE_IN', 'MANUAL_ADJUSTMENT', 'CONSUMPTION', 'WASTAGE', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_TO_SUPPLIER', 'INITIAL_STOCK');
CREATE TABLE stock_movements (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "inventoryItemId" uuid NOT NULL,
  "organizationId"  varchar NOT NULL,
  "locationId"      varchar NOT NULL,
  "movementType"    stock_movements_movementtype_enum NOT NULL,
  quantity          numeric(10,2) NOT NULL,
  "previousStock"   numeric(10,2) NOT NULL,
  "newStock"        numeric(10,2) NOT NULL,
  "referenceType"   varchar,
  "referenceId"     varchar,
  "batchNumber"     varchar,
  "expiryDate"      date,
  notes             text,
  "performedBy"     uuid NOT NULL,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_stock_movements_inventoryItemId" FOREIGN KEY ("inventoryItemId") REFERENCES inventory_items (id) ON DELETE CASCADE,
  CONSTRAINT "fk_stock_movements_performedBy" FOREIGN KEY ("performedBy") REFERENCES employees (id)
);
CREATE INDEX "idx_stock_movements_referenceType_referenceId" ON stock_movements ("referenceType", "referenceId");
CREATE INDEX "idx_stock_movements_organizationId_locationId_movementType" ON stock_movements ("organizationId", "locationId", "movementType");
CREATE INDEX "idx_stock_movements_inventoryItemId_createdAt" ON stock_movements ("inventoryItemId", "createdAt");

-- ------------------------------------------------------------------------
-- magic_links   (src/lab-access/entities/magic-link.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE magic_links_purpose_enum AS ENUM ('lab_view_order', 'lab_update_order', 'receive_shipment');
CREATE TYPE magic_links_delivery_enum AS ENUM ('notification', 'copy');
CREATE TABLE magic_links (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  token_hash      char(64) NOT NULL,
  nonce           char(64) NOT NULL,
  purpose         magic_links_purpose_enum NOT NULL,
  lab_id          uuid NOT NULL,
  order_id        uuid NOT NULL,
  shipment_id     uuid,
  recipient_phone varchar(20),
  delivery        magic_links_delivery_enum NOT NULL,
  expires_at      timestamptz NOT NULL,
  max_uses        integer,
  used_count      integer NOT NULL DEFAULT 0,
  last_used_at    timestamptz,
  last_viewed_at  timestamptz,
  revoked_at      timestamptz,
  revoked_reason  varchar(40),
  revoked_by      uuid,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_magic_links_uses CHECK ("max_uses" IS NULL OR ("max_uses" > 0 AND "used_count" <= "max_uses")),
  CONSTRAINT fk_magic_links_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_magic_links_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT,
  CONSTRAINT fk_magic_links_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_magic_links_token_hash ON magic_links (token_hash);
CREATE INDEX idx_magic_links_order ON magic_links (order_id, created_at);

-- ------------------------------------------------------------------------
-- lab_billing_settings   (src/lab-billing/entities/lab-credit.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE lab_billing_settings (
  organization_id uuid PRIMARY KEY,
  tax_rate_bp     integer NOT NULL DEFAULT 0,
  due_days        integer NOT NULL DEFAULT 0,
  updated_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_lab_billing_settings CHECK ("tax_rate_bp" BETWEEN 0 AND 10000 AND "due_days" BETWEEN 0 AND 365)
);

-- ------------------------------------------------------------------------
-- lab_payment_allocations   (src/lab-billing/entities/lab-payment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_payment_allocations_release_reason_enum AS ENUM ('payment_reversed', 'credit_note');
CREATE TABLE lab_payment_allocations (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  payment_id      uuid NOT NULL,
  invoice_id      uuid NOT NULL,
  amount_minor    bigint NOT NULL DEFAULT 0,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reversed_at     timestamptz,
  reversed_by     uuid,
  release_reason  lab_payment_allocations_release_reason_enum,
  CONSTRAINT chk_lab_payment_allocations_amount CHECK ("amount_minor" > 0),
  CONSTRAINT fk_lab_payment_allocations_payment_id FOREIGN KEY (payment_id) REFERENCES lab_payments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_payment_allocations_invoice_id FOREIGN KEY (invoice_id) REFERENCES lab_invoices (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_payment_allocations_invoice ON lab_payment_allocations (invoice_id);
CREATE INDEX idx_lab_payment_allocations_payment ON lab_payment_allocations (payment_id);

-- ------------------------------------------------------------------------
-- lab_refund_sources   (src/lab-billing/entities/lab-credit.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE lab_refund_sources (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  refund_id       uuid NOT NULL,
  payment_id      uuid NOT NULL,
  amount_minor    bigint NOT NULL DEFAULT 0,
  CONSTRAINT chk_lab_refund_sources_amount CHECK ("amount_minor" > 0),
  CONSTRAINT fk_lab_refund_sources_refund_id FOREIGN KEY (refund_id) REFERENCES lab_refunds (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_refund_sources_payment_id FOREIGN KEY (payment_id) REFERENCES lab_payments (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_refund_sources_payment ON lab_refund_sources (payment_id);
CREATE INDEX idx_lab_refund_sources_refund ON lab_refund_sources (refund_id);

-- ------------------------------------------------------------------------
-- lab_service_options   (src/lab-catalog/entities/lab-service-option.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_service_options_option_type_enum AS ENUM ('material', 'variant');
CREATE TABLE lab_service_options (
  id               uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  lab_service_id   uuid NOT NULL,
  option_type      lab_service_options_option_type_enum NOT NULL,
  code             varchar(50) NOT NULL,
  name             varchar(150) NOT NULL,
  extra_cost_minor bigint NOT NULL DEFAULT 0,
  sort_order       integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_by       uuid,
  version          integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_lab_service_options_code UNIQUE (lab_service_id, code),
  CONSTRAINT chk_lab_service_options_cost CHECK ("extra_cost_minor" >= 0),
  CONSTRAINT fk_lab_service_options_lab_service_id FOREIGN KEY (lab_service_id) REFERENCES lab_services (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- lab_service_prices   (src/lab-catalog/entities/lab-service-price.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE lab_service_prices (
  id                   uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  lab_service_id       uuid NOT NULL,
  organization_id      uuid,
  unit_price_minor     bigint NOT NULL DEFAULT 0,
  rush_surcharge_minor bigint NOT NULL DEFAULT 0,
  currency             char(3) NOT NULL DEFAULT 'PKR',
  effective_from       date NOT NULL,
  effective_to         date,
  notes                text,
  voided_at            timestamptz,
  void_reason          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_by           uuid,
  version              integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_lab_service_prices_dates CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT chk_lab_service_prices_amounts CHECK ("unit_price_minor" >= 0 AND "rush_surcharge_minor" >= 0),
  CONSTRAINT excl_lab_service_prices_overlap EXCLUDE USING gist ("lab_service_id" WITH =, COALESCE("organization_id", '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange("effective_from", "effective_to", '[]') WITH &&) WHERE ("voided_at" IS NULL),
  CONSTRAINT fk_lab_service_prices_lab_service_id FOREIGN KEY (lab_service_id) REFERENCES lab_services (id) ON DELETE RESTRICT,
  CONSTRAINT fk_lab_service_prices_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_service_prices_lookup ON lab_service_prices (lab_service_id, organization_id, effective_from);

-- ------------------------------------------------------------------------
-- order_templates   (src/lab-catalog/entities/order-template.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE order_templates (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  owner_user_id   uuid,
  specialty_id    uuid NOT NULL,
  lab_id          uuid,
  name            varchar(150) NOT NULL,
  template_json   jsonb NOT NULL,
  use_count       integer NOT NULL DEFAULT 0,
  last_used_at    timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_order_templates_use_count CHECK ("use_count" >= 0),
  CONSTRAINT fk_order_templates_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_templates_specialty_id FOREIGN KEY (specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_templates_lab_id FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE RESTRICT
);
CREATE INDEX idx_order_templates_org_owner ON order_templates (organization_id, owner_user_id, is_active);

-- ------------------------------------------------------------------------
-- service_mappings   (src/lab-catalog/entities/service-mapping.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE service_mappings (
  id                  uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id     uuid NOT NULL,
  clinic_treatment_id uuid NOT NULL,
  lab_service_id      uuid NOT NULL,
  is_default          boolean NOT NULL DEFAULT false,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_by          uuid,
  version             integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_service_mappings_pair UNIQUE (organization_id, clinic_treatment_id, lab_service_id),
  CONSTRAINT fk_service_mappings_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_service_mappings_clinic_treatment_id FOREIGN KEY (clinic_treatment_id) REFERENCES services (id) ON DELETE RESTRICT,
  CONSTRAINT fk_service_mappings_lab_service_id FOREIGN KEY (lab_service_id) REFERENCES lab_services (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_service_mappings_default ON service_mappings (organization_id, clinic_treatment_id) WHERE "is_active" AND "is_default";
CREATE UNIQUE INDEX uq_service_mappings_lab_service ON service_mappings (organization_id, lab_service_id) WHERE "is_active";

-- ------------------------------------------------------------------------
-- attachments   (src/lab-orders/entities/attachment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE attachments_visibility_enum AS ENUM ('internal', 'lab_shared', 'patient_shared');
CREATE TYPE attachments_uploaded_side_enum AS ENUM ('clinic', 'lab');
CREATE TABLE attachments (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  entity_type     varchar(30) NOT NULL,
  entity_id       uuid NOT NULL,
  order_id        uuid NOT NULL,
  storage_key     text NOT NULL,
  file_name       varchar(255) NOT NULL,
  mime_type       varchar(100) NOT NULL,
  size_bytes      bigint NOT NULL,
  sha256          char(64) NOT NULL,
  visibility      attachments_visibility_enum NOT NULL,
  uploaded_side   attachments_uploaded_side_enum NOT NULL,
  uploaded_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_attachments_size CHECK ("size_bytes" >= 0),
  CONSTRAINT chk_attachments_entity_type CHECK ("entity_type" IN ('lab_order','lab_order_item'))
);
CREATE INDEX idx_attachments_entity ON attachments (entity_type, entity_id);

-- ------------------------------------------------------------------------
-- dental_item_details   (src/lab-orders/entities/item-parts.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE dental_item_details (
  item_id             uuid PRIMARY KEY,
  organization_id     uuid NOT NULL,
  shade_system        varchar(50),
  shade               varchar(20),
  material_code       varchar(50),
  implant_system      varchar(100),
  implant_platform    varchar(100),
  implant_diameter_mm numeric(4,2),
  margin_type         varchar(50),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_dental_item_details_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- item_form_responses   (src/lab-orders/entities/item-parts.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE item_form_responses (
  item_id                uuid PRIMARY KEY,
  organization_id        uuid NOT NULL,
  form_schema_version_id uuid,
  data                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  validated_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_item_form_responses_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT,
  CONSTRAINT fk_item_form_responses_form_schema_version_id FOREIGN KEY (form_schema_version_id) REFERENCES form_schema_versions (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- item_teeth   (src/lab-orders/entities/item-parts.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE item_teeth (
  id               uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id  uuid NOT NULL,
  item_id          uuid NOT NULL,
  numbering_system varchar(10) NOT NULL DEFAULT 'FDI',
  tooth_code       varchar(5) NOT NULL,
  dentition        varchar(10) NOT NULL,
  tooth_role       varchar(20),
  surfaces         text[] NOT NULL DEFAULT '{}',
  CONSTRAINT uq_item_teeth_tooth UNIQUE (item_id, tooth_code),
  CONSTRAINT chk_item_teeth_numbering CHECK ("numbering_system" IN ('FDI','UNIVERSAL','PALMER')),
  CONSTRAINT fk_item_teeth_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT
);
CREATE INDEX idx_item_teeth_item ON item_teeth (item_id);

-- ------------------------------------------------------------------------
-- order_messages   (src/lab-orders/entities/order-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE order_messages_author_side_enum AS ENUM ('clinic', 'lab');
CREATE TYPE order_messages_kind_enum AS ENUM ('note', 'clarification_request', 'reply');
CREATE TABLE order_messages (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  order_id        uuid NOT NULL,
  item_id         uuid,
  author_user_id  uuid,
  author_side     order_messages_author_side_enum NOT NULL,
  kind            order_messages_kind_enum NOT NULL,
  body            text NOT NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_order_messages_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_messages_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT
);
CREATE INDEX idx_order_messages_order ON order_messages (order_id, created_at);

-- ------------------------------------------------------------------------
-- order_revisions   (src/lab-orders/entities/order-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE order_revisions (
  id                  uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id     uuid NOT NULL,
  order_id            uuid NOT NULL,
  revision_no         integer NOT NULL,
  snapshot            jsonb NOT NULL,
  reason              text,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  lab_acknowledged_at timestamptz,
  lab_acknowledged_by uuid,
  CONSTRAINT uq_order_revisions_no UNIQUE (order_id, revision_no),
  CONSTRAINT fk_order_revisions_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- lab_statement_lines   (src/lab-payables/entities/lab-statement.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE lab_statement_lines_match_status_enum AS ENUM ('matched', 'amount_mismatch', 'missing_in_system', 'missing_in_statement');
CREATE TABLE lab_statement_lines (
  id                   uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id      uuid NOT NULL,
  statement_id         uuid NOT NULL,
  lab_reference        varchar(60),
  line_date            date,
  description          varchar(300),
  amount_minor         bigint NOT NULL DEFAULT 0,
  system_amount_minor  bigint,
  matched_bill_line_id uuid,
  matched_bill_id      uuid,
  match_status         lab_statement_lines_match_status_enum NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_lab_statement_lines_statement_id FOREIGN KEY (statement_id) REFERENCES lab_statements (id) ON DELETE RESTRICT
);
CREATE INDEX idx_lab_statement_lines_statement ON lab_statement_lines (statement_id);

-- ------------------------------------------------------------------------
-- vendor_bill_lines   (src/lab-payables/entities/vendor-bill.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE vendor_bill_lines_line_kind_enum AS ENUM ('service', 'rush', 'shipping', 'material', 'remake', 'other');
CREATE TABLE vendor_bill_lines (
  id                uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id   uuid NOT NULL,
  vendor_bill_id    uuid NOT NULL,
  line_kind         vendor_bill_lines_line_kind_enum NOT NULL,
  lab_order_id      uuid,
  order_item_id     uuid,
  charge_request_id uuid,
  remake_request_id uuid,
  description       varchar(300) NOT NULL,
  quantity          integer NOT NULL DEFAULT 1,
  unit_cost_minor   bigint NOT NULL DEFAULT 0,
  line_total_minor  bigint NOT NULL DEFAULT 0,
  is_manual         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_vendor_bill_lines_minor CHECK ("quantity" > 0 AND "unit_cost_minor" >= 0 AND "line_total_minor" >= 0),
  CONSTRAINT fk_vendor_bill_lines_vendor_bill_id FOREIGN KEY (vendor_bill_id) REFERENCES vendor_bills (id) ON DELETE RESTRICT
);
CREATE INDEX idx_vendor_bill_lines_charge ON vendor_bill_lines (charge_request_id);
CREATE INDEX idx_vendor_bill_lines_item ON vendor_bill_lines (order_item_id);
CREATE INDEX idx_vendor_bill_lines_bill ON vendor_bill_lines (vendor_bill_id);

-- ------------------------------------------------------------------------
-- vendor_payment_allocations   (src/lab-payables/entities/vendor-payment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE vendor_payment_allocations (
  id                uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id   uuid NOT NULL,
  vendor_payment_id uuid NOT NULL,
  vendor_bill_id    uuid NOT NULL,
  amount_minor      bigint NOT NULL DEFAULT 0,
  reversed_at       timestamptz,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_vendor_payment_allocations_minor CHECK ("amount_minor" > 0),
  CONSTRAINT fk_vendor_payment_allocations_vendor_payment_id FOREIGN KEY (vendor_payment_id) REFERENCES vendor_payments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_vendor_payment_allocations_vendor_bill_id FOREIGN KEY (vendor_bill_id) REFERENCES vendor_bills (id) ON DELETE RESTRICT
);
CREATE INDEX idx_vendor_payment_allocations_bill ON vendor_payment_allocations (vendor_bill_id);
CREATE INDEX idx_vendor_payment_allocations_payment ON vendor_payment_allocations (vendor_payment_id);

-- ------------------------------------------------------------------------
-- item_assignments   (src/lab-production/entities/production-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE item_assignments (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  lab_id          uuid NOT NULL,
  item_id         uuid NOT NULL,
  lab_member_id   uuid NOT NULL,
  assigned_by     uuid,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  unassigned_at   timestamptz,
  unassigned_by   uuid,
  CONSTRAINT fk_item_assignments_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT,
  CONSTRAINT fk_item_assignments_lab_member_id FOREIGN KEY (lab_member_id) REFERENCES lab_members (id) ON DELETE RESTRICT
);
CREATE INDEX idx_item_assignments_member ON item_assignments (lab_member_id, unassigned_at);
CREATE UNIQUE INDEX uq_item_assignments_open ON item_assignments (item_id) WHERE "unassigned_at" IS NULL;

-- ------------------------------------------------------------------------
-- item_warranties   (src/lab-production/entities/production-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE item_warranties (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  item_id         uuid NOT NULL,
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  terms           text,
  voided_at       timestamptz,
  void_reason     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_item_warranties_item UNIQUE (item_id),
  CONSTRAINT chk_item_warranties_dates CHECK ("ends_on" >= "starts_on"),
  CONSTRAINT fk_item_warranties_item_id FOREIGN KEY (item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------
-- remake_requests   (src/lab-production/entities/production-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE remake_requests_reason_code_enum AS ENUM ('shade', 'fit', 'fracture', 'design', 'damaged', 'other');
CREATE TYPE remake_requests_responsible_party_enum AS ENUM ('lab', 'clinic', 'patient', 'undetermined');
CREATE TYPE remake_requests_status_enum AS ENUM ('requested', 'agreed', 'disputed', 'closed');
CREATE TABLE remake_requests (
  id                   uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id      uuid NOT NULL,
  lab_id               uuid NOT NULL,
  order_id             uuid NOT NULL,
  original_item_id     uuid NOT NULL,
  new_item_id          uuid,
  reason_code          remake_requests_reason_code_enum NOT NULL,
  notes                text,
  responsible_party    remake_requests_responsible_party_enum NOT NULL DEFAULT 'undetermined',
  is_warranty_claim    boolean NOT NULL DEFAULT false,
  warranty_id          uuid,
  lab_charge_minor     bigint,
  patient_charge_minor bigint,
  status               remake_requests_status_enum NOT NULL DEFAULT 'requested',
  requested_by         uuid,
  decided_by           uuid,
  decided_at           timestamptz,
  decision_note        text,
  dispute_note         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  version              integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_remake_requests_new_item UNIQUE (new_item_id),
  CONSTRAINT chk_remake_requests_minor CHECK (("lab_charge_minor" IS NULL OR "lab_charge_minor" >= 0) AND ("patient_charge_minor" IS NULL OR "patient_charge_minor" >= 0)),
  CONSTRAINT fk_remake_requests_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_remake_requests_original_item_id FOREIGN KEY (original_item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT,
  CONSTRAINT fk_remake_requests_new_item_id FOREIGN KEY (new_item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT
);
CREATE INDEX idx_remake_requests_order ON remake_requests (order_id);
CREATE INDEX idx_remake_requests_lab_status ON remake_requests (lab_id, status);
CREATE UNIQUE INDEX uq_remake_requests_open ON remake_requests (original_item_id) WHERE "status" IN ('requested','disputed');

-- ------------------------------------------------------------------------
-- shipment_items   (src/lab-production/entities/production-records.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE shipment_items_contents_enum AS ENUM ('impression', 'model', 'framework', 'tryin', 'final', 'other');
CREATE TYPE shipment_items_condition_enum AS ENUM ('ok', 'damaged', 'missing');
CREATE TYPE shipment_items_qc_result_enum AS ENUM ('pass', 'fail');
CREATE TABLE shipment_items (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  shipment_id     uuid NOT NULL,
  order_id        uuid NOT NULL,
  order_item_id   uuid NOT NULL,
  item_stage_id   uuid,
  contents        shipment_items_contents_enum NOT NULL,
  quantity        integer NOT NULL DEFAULT 1,
  received_qty    integer,
  condition       shipment_items_condition_enum,
  qc_result       shipment_items_qc_result_enum,
  qc_notes        text,
  received_at     timestamptz,
  received_by     uuid,
  CONSTRAINT uq_shipment_items_item UNIQUE (shipment_id, order_item_id),
  CONSTRAINT chk_shipment_items_received CHECK ("received_qty" IS NULL OR ("received_qty" >= 0 AND "received_qty" <= "quantity")),
  CONSTRAINT chk_shipment_items_qty CHECK ("quantity" > 0),
  CONSTRAINT fk_shipment_items_shipment_id FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_shipment_items_order_id FOREIGN KEY (order_id) REFERENCES lab_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_shipment_items_order_item_id FOREIGN KEY (order_item_id) REFERENCES lab_order_items (id) ON DELETE RESTRICT,
  CONSTRAINT fk_shipment_items_item_stage_id FOREIGN KEY (item_stage_id) REFERENCES order_item_stages (id) ON DELETE RESTRICT
);
CREATE INDEX idx_shipment_items_item ON shipment_items (order_item_id);

-- ------------------------------------------------------------------------
-- location_settings   (src/locations/entities/location-settings.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE location_settings (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id               uuid NOT NULL,
  organization_id           uuid,
  appointment_slot_duration integer NOT NULL DEFAULT 30,
  max_appointments_per_day  integer NOT NULL DEFAULT 50,
  advance_booking_days      integer NOT NULL DEFAULT 30,
  cancellation_notice_hours integer NOT NULL DEFAULT 24,
  reminder_enabled          boolean NOT NULL DEFAULT true,
  reminder_days_before      integer NOT NULL DEFAULT 1,
  reminder_hours_before     integer NOT NULL DEFAULT 2,
  reminder_channels         jsonb NOT NULL DEFAULT '["email"]',
  payment_gateway           varchar(50),
  tax_rate                  numeric(5,2) NOT NULL DEFAULT 0,
  late_fee_percentage       numeric(5,2) NOT NULL DEFAULT 0,
  logo_url                  varchar(500),
  primary_color             varchar(20),
  theme                     varchar(20) NOT NULL DEFAULT 'light',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_location_settings_location_id UNIQUE (location_id),
  CONSTRAINT uq_location_settings_location_id_2 UNIQUE (location_id),
  CONSTRAINT fk_location_settings_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_location_settings_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_location_settings_location_id ON location_settings (location_id);

-- ------------------------------------------------------------------------
-- notification_audience_settings   (src/notifications/entities/notification-audience-setting.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE notification_audience_settings (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  audience        text NOT NULL,
  is_enabled      boolean NOT NULL,
  quiet_start     time,
  quiet_end       time,
  timezone        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_notification_audience_settings_org_audience UNIQUE (organization_id, audience),
  CONSTRAINT chk_notification_audience_settings_quiet CHECK (("quiet_start" IS NULL) = ("quiet_end" IS NULL)),
  CONSTRAINT chk_notification_audience_settings_audience CHECK ("audience" IN ('patient', 'doctor', 'coordinator', 'lab', 'staff')),
  CONSTRAINT fk_notification_audience_settings_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------
-- notification_platform_overrides   (src/notifications/entities/notification-platform-override.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE notification_platform_overrides (
  organization_id uuid NOT NULL,
  event_code      text NOT NULL,
  channel         text NOT NULL,
  mode            text NOT NULL,
  updated_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, event_code, channel),
  CONSTRAINT chk_notification_platform_overrides_mode CHECK ("mode" IN ('on', 'off'))
);

-- ------------------------------------------------------------------------
-- notification_rules   (src/notifications/entities/notification-rule.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE notification_rules (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  organization_id uuid NOT NULL,
  event_code      text NOT NULL,
  audience        text NOT NULL,
  channel         text NOT NULL,
  is_enabled      boolean NOT NULL,
  template_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  version         integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_notification_rules_org_event_audience_channel UNIQUE (organization_id, event_code, audience, channel),
  CONSTRAINT chk_notification_rules_channel CHECK ("channel" IN ('in_app', 'whatsapp', 'sms', 'email', 'push')),
  CONSTRAINT chk_notification_rules_audience CHECK ("audience" IN ('patient', 'doctor', 'coordinator', 'lab', 'staff')),
  CONSTRAINT fk_notification_rules_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_rules_event_code FOREIGN KEY (event_code) REFERENCES notification_events (code) ON DELETE RESTRICT,
  CONSTRAINT fk_notification_rules_template_id FOREIGN KEY (template_id) REFERENCES notification_templates (id) ON DELETE SET NULL
);

-- ------------------------------------------------------------------------
-- patient_comm_prefs   (src/notifications/entities/patient-comm-pref.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_comm_prefs (
  patient_id         uuid PRIMARY KEY,
  organization_id    uuid NOT NULL,
  whatsapp_opt_out   boolean NOT NULL DEFAULT false,
  sms_opt_out        boolean NOT NULL DEFAULT false,
  email_opt_out      boolean NOT NULL DEFAULT false,
  preferred_language text,
  opted_out_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  version            integer NOT NULL DEFAULT 1,
  CONSTRAINT chk_patient_comm_prefs_language CHECK ("preferred_language" IS NULL OR "preferred_language" IN ('en', 'ur', 'roman_ur')),
  CONSTRAINT fk_patient_comm_prefs_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_comm_prefs_org ON patient_comm_prefs (organization_id);

-- ------------------------------------------------------------------------
-- user_notification_prefs   (src/notifications/entities/user-notification-pref.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE user_notification_prefs (
  user_id    uuid NOT NULL,
  key        text NOT NULL,
  enabled    boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key),
  CONSTRAINT fk_user_notification_prefs_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE
);

-- ------------------------------------------------------------------------
-- user_notifications   (src/notifications/entities/user-notification.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE user_notifications (
  id              uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  user_id         uuid NOT NULL,
  outbox_id       uuid NOT NULL,
  organization_id uuid NOT NULL,
  event_code      text NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_notifications_outbox_id UNIQUE (outbox_id),
  CONSTRAINT uq_user_notifications_outbox_id_2 UNIQUE (outbox_id),
  CONSTRAINT fk_user_notifications_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE,
  CONSTRAINT fk_user_notifications_outbox_id FOREIGN KEY (outbox_id) REFERENCES notification_outbox (id) ON DELETE RESTRICT
);
CREATE INDEX idx_user_notifications_unread ON user_notifications (user_id) WHERE "read_at" IS NULL;
CREATE INDEX idx_user_notifications_user_created ON user_notifications (user_id, created_at);

-- ------------------------------------------------------------------------
-- organization_ownership   (src/organizations/entities/organization-ownership.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE organization_ownership (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid NOT NULL,
  organization_id  uuid NOT NULL,
  is_primary_owner boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_ownership_user_id_organization_id UNIQUE (user_id, organization_id),
  CONSTRAINT fk_organization_ownership_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE,
  CONSTRAINT fk_organization_ownership_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_organization_ownership_user_id_organization_id ON organization_ownership (user_id, organization_id);

-- ------------------------------------------------------------------------
-- organization_settings   (src/organizations/entities/organization-settings.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE organization_settings (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id           uuid NOT NULL,
  feature_appointments      boolean NOT NULL DEFAULT true,
  feature_inventory         boolean NOT NULL DEFAULT true,
  feature_finance           boolean NOT NULL DEFAULT true,
  feature_reminders         boolean NOT NULL DEFAULT true,
  feature_whatsapp          boolean NOT NULL DEFAULT false,
  feature_patient_portal    boolean NOT NULL DEFAULT false,
  allow_location_override   boolean NOT NULL DEFAULT true,
  default_slot_duration     integer NOT NULL DEFAULT 30,
  advance_booking_days      integer NOT NULL DEFAULT 30,
  cancellation_notice_hours integer NOT NULL DEFAULT 24,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_settings_organization_id UNIQUE (organization_id),
  CONSTRAINT uq_organization_settings_organization_id_2 UNIQUE (organization_id),
  CONSTRAINT fk_organization_settings_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_organization_settings_organization_id ON organization_settings (organization_id);

-- ------------------------------------------------------------------------
-- patient_communications   (src/patients/entities/patient-communication.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_communications_type_enum AS ENUM ('sms', 'whatsapp', 'call', 'email', 'in_person');
CREATE TYPE patient_communications_direction_enum AS ENUM ('inbound', 'outbound');
CREATE TYPE patient_communications_purpose_enum AS ENUM ('appointment_reminder', 'appointment_confirmation', 'appointment_cancellation', 'recall_reminder', 'follow_up', 'billing', 'general', 'marketing', 'emergency');
CREATE TYPE patient_communications_status_enum AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed', 'received');
CREATE TABLE patient_communications (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id          uuid NOT NULL,
  location_id         uuid NOT NULL,
  organization_id     uuid NOT NULL,
  appointment_id      uuid,
  type                patient_communications_type_enum NOT NULL,
  direction           patient_communications_direction_enum NOT NULL,
  purpose             patient_communications_purpose_enum NOT NULL DEFAULT 'general',
  subject             varchar(300),
  message_body        text,
  status              patient_communications_status_enum NOT NULL DEFAULT 'pending',
  sent_at             timestamptz,
  delivered_at        timestamptz,
  read_at             timestamptz,
  sent_by             uuid,
  is_automated        boolean NOT NULL DEFAULT false,
  automation_trigger  varchar(100),
  external_message_id varchar(200),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_communications_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_communications_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_communications_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_communications_status ON patient_communications (status);
CREATE INDEX idx_patient_communications_sent_at ON patient_communications (sent_at);
CREATE INDEX idx_patient_communications_type ON patient_communications (type);
CREATE INDEX idx_patient_communications_organization_id ON patient_communications (organization_id);
CREATE INDEX idx_patient_communications_patient_id ON patient_communications (patient_id);

-- ------------------------------------------------------------------------
-- patient_consents   (src/patients/entities/patient-consent.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_consents_consent_type_enum AS ENUM ('general_treatment', 'extraction', 'implant', 'root_canal', 'orthodontic', 'sedation', 'photo_release');
CREATE TABLE patient_consents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id      uuid NOT NULL,
  location_id     uuid NOT NULL,
  organization_id uuid NOT NULL,
  appointment_id  uuid,
  consent_type    patient_consents_consent_type_enum NOT NULL,
  consent_version varchar(20) NOT NULL DEFAULT '1.0',
  consent_text    text NOT NULL,
  is_agreed       boolean NOT NULL,
  agreed_at       timestamptz NOT NULL DEFAULT NOW(),
  signed_by_name  varchar(150) NOT NULL,
  signed_by_type  varchar(20) NOT NULL DEFAULT 'patient',
  witnessed_by    uuid,
  signature_url   text,
  ip_address      varchar(45),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_consents_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_consents_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_consents_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_consents_appointment_id ON patient_consents (appointment_id);
CREATE INDEX idx_patient_consents_consent_type ON patient_consents (consent_type);
CREATE INDEX idx_patient_consents_organization_id ON patient_consents (organization_id);
CREATE INDEX idx_patient_consents_patient_id ON patient_consents (patient_id);

-- ------------------------------------------------------------------------
-- patient_dental_info   (src/patients/entities/patient-dental-info.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_dental_info_gum_condition_enum AS ENUM ('healthy', 'mild_gingivitis', 'moderate_gingivitis', 'severe_periodontitis');
CREATE TYPE patient_dental_info_brushing_frequency_enum AS ENUM ('once_daily', 'twice_daily', 'irregular', 'unknown');
CREATE TYPE patient_dental_info_flossing_frequency_enum AS ENUM ('daily', 'occasionally', 'never', 'unknown');
CREATE TABLE patient_dental_info (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id            uuid NOT NULL,
  organization_id       uuid NOT NULL,
  last_dental_checkup   date,
  teeth_condition_notes text,
  gum_condition         patient_dental_info_gum_condition_enum NOT NULL DEFAULT 'healthy',
  teeth_sensitivity     boolean NOT NULL DEFAULT false,
  sensitivity_notes     text,
  brushing_frequency    patient_dental_info_brushing_frequency_enum NOT NULL DEFAULT 'unknown',
  flossing_frequency    patient_dental_info_flossing_frequency_enum NOT NULL DEFAULT 'unknown',
  smoking_status        boolean NOT NULL DEFAULT false,
  tobacco_chewing       boolean NOT NULL DEFAULT false,
  orthodontic_history   boolean NOT NULL DEFAULT false,
  orthodontic_notes     text,
  prosthetics_info      text,
  previous_extractions  text,
  previous_surgeries    text,
  xray_notes            text,
  dentist_notes         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_patient_dental_info_patient_id UNIQUE (patient_id),
  CONSTRAINT uq_patient_dental_info_patient_id_2 UNIQUE (patient_id),
  CONSTRAINT fk_patient_dental_info_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_dental_info_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_dental_info_organization_id ON patient_dental_info (organization_id);
CREATE UNIQUE INDEX idx_patient_dental_info_patient_id ON patient_dental_info (patient_id);

-- ------------------------------------------------------------------------
-- patient_documents   (src/patients/entities/patient-document.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_documents_document_type_enum AS ENUM ('xray', 'cbct_scan', 'report', 'prescription', 'consent_form', 'insurance_card', 'cnic_copy', 'photo_before', 'photo_after', 'other');
CREATE TABLE patient_documents (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id            uuid NOT NULL,
  location_id           uuid NOT NULL,
  organization_id       uuid NOT NULL,
  appointment_id        uuid,
  document_type         patient_documents_document_type_enum NOT NULL,
  file_name             varchar(255) NOT NULL,
  file_url              text NOT NULL,
  thumbnail_url         text,
  file_size_bytes       integer,
  mime_type             varchar(100),
  notes                 text,
  tooth_number          varchar(10),
  taken_date            date,
  is_visible_to_patient boolean NOT NULL DEFAULT false,
  uploaded_by           uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  CONSTRAINT fk_patient_documents_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_documents_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_documents_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_documents_appointment_id ON patient_documents (appointment_id);
CREATE INDEX idx_patient_documents_document_type ON patient_documents (document_type);
CREATE INDEX idx_patient_documents_organization_id ON patient_documents (organization_id);
CREATE INDEX idx_patient_documents_patient_id ON patient_documents (patient_id);

-- ------------------------------------------------------------------------
-- patient_feedback   (src/patients/entities/patient-feedback.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_feedback_category_enum AS ENUM ('doctor', 'service', 'facility', 'billing', 'waiting_time', 'general');
CREATE TABLE patient_feedback (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id      uuid NOT NULL,
  location_id     uuid NOT NULL,
  organization_id uuid NOT NULL,
  appointment_id  uuid,
  dentist_id      uuid,
  rating          integer NOT NULL,
  category        patient_feedback_category_enum NOT NULL DEFAULT 'general',
  feedback_text   text,
  is_anonymous    boolean NOT NULL DEFAULT false,
  is_published    boolean NOT NULL DEFAULT false,
  response_text   text,
  responded_by    uuid,
  responded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_feedback_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_feedback_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_feedback_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_feedback_organization_id_is_published ON patient_feedback (organization_id, is_published);
CREATE INDEX idx_patient_feedback_rating ON patient_feedback (rating);
CREATE INDEX idx_patient_feedback_dentist_id ON patient_feedback (dentist_id);
CREATE INDEX idx_patient_feedback_organization_id ON patient_feedback (organization_id);
CREATE INDEX idx_patient_feedback_patient_id ON patient_feedback (patient_id);

-- ------------------------------------------------------------------------
-- patient_insurance   (src/patients/entities/patient-insurance.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_insurance (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id          uuid NOT NULL,
  organization_id     uuid NOT NULL,
  provider_name       varchar(150) NOT NULL,
  plan_name           varchar(150),
  policy_number       varchar(100) NOT NULL,
  policy_holder_name  varchar(150),
  group_number        varchar(100),
  coverage_details    text,
  coverage_percentage integer NOT NULL DEFAULT 0,
  max_annual_benefit  numeric(12,2),
  used_benefit        numeric(12,2) NOT NULL DEFAULT 0,
  valid_from          date,
  valid_until         date,
  is_active           boolean NOT NULL DEFAULT true,
  card_front_url      text,
  card_back_url       text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_insurance_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_insurance_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_insurance_patient_id_is_active ON patient_insurance (patient_id, is_active);
CREATE INDEX idx_patient_insurance_organization_id ON patient_insurance (organization_id);
CREATE INDEX idx_patient_insurance_patient_id ON patient_insurance (patient_id);

-- ------------------------------------------------------------------------
-- patient_prescriptions   (src/patients/entities/patient-prescription.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_prescriptions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id           uuid NOT NULL,
  location_id          uuid NOT NULL,
  organization_id      uuid NOT NULL,
  prescribed_by        uuid NOT NULL,
  appointment_id       uuid,
  prescription_number  varchar(20) NOT NULL,
  prescription_date    date NOT NULL DEFAULT ('now'::text)::date,
  chief_complaint      text,
  diagnosis            text,
  medications          jsonb NOT NULL DEFAULT '[]',
  special_instructions text,
  follow_up_date       date,
  is_printed           boolean NOT NULL DEFAULT false,
  printed_at           timestamptz,
  print_count          integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_prescriptions_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_prescriptions_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_prescriptions_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_prescriptions_prescription_date ON patient_prescriptions (prescription_date);
CREATE INDEX idx_patient_prescriptions_prescribed_by ON patient_prescriptions (prescribed_by);
CREATE INDEX idx_patient_prescriptions_organization_id ON patient_prescriptions (organization_id);
CREATE INDEX idx_patient_prescriptions_patient_id ON patient_prescriptions (patient_id);
CREATE UNIQUE INDEX idx_patient_prescriptions_organization_id_prescription_number ON patient_prescriptions (organization_id, prescription_number);

-- ------------------------------------------------------------------------
-- patient_recalls   (src/patients/entities/patient-recall.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_recalls_recall_type_enum AS ENUM ('6_month_checkup', 'annual_cleaning', 'post_treatment_followup', 'implant_review', 'orthodontic_review', 'custom');
CREATE TYPE patient_recalls_status_enum AS ENUM ('scheduled', 'reminder_sent', 'contacted', 'booked', 'completed', 'ignored', 'overdue');
CREATE TABLE patient_recalls (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id              uuid NOT NULL,
  location_id             uuid NOT NULL,
  organization_id         uuid NOT NULL,
  dentist_id              uuid,
  appointment_id          uuid,
  recall_type             patient_recalls_recall_type_enum NOT NULL,
  custom_name             varchar(200),
  due_date                date NOT NULL,
  first_reminder_sent_at  timestamptz,
  second_reminder_sent_at timestamptz,
  third_reminder_sent_at  timestamptz,
  status                  patient_recalls_status_enum NOT NULL DEFAULT 'scheduled',
  notes                   text,
  created_by              uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_recalls_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_recalls_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_recalls_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_recalls_status ON patient_recalls (status);
CREATE INDEX idx_patient_recalls_due_date ON patient_recalls (due_date);
CREATE INDEX idx_patient_recalls_organization_id ON patient_recalls (organization_id);
CREATE INDEX idx_patient_recalls_patient_id ON patient_recalls (patient_id);

-- ------------------------------------------------------------------------
-- patient_referrals   (src/patients/entities/patient-referral.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE patient_referrals_status_enum AS ENUM ('pending', 'registered', 'rewarded', 'cancelled');
CREATE TABLE patient_referrals (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id      uuid NOT NULL,
  referring_patient_id uuid NOT NULL,
  referred_patient_id  uuid,
  referred_name        varchar(150),
  referred_phone       varchar(20),
  referral_date        date NOT NULL DEFAULT ('now'::text)::date,
  reward_given         boolean NOT NULL DEFAULT false,
  reward_amount        numeric(8,2),
  reward_type          varchar(50),
  reward_given_at      timestamptz,
  status               patient_referrals_status_enum NOT NULL DEFAULT 'pending',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_referrals_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_referrals_referring_patient_id FOREIGN KEY (referring_patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_referrals_referred_patient_id FOREIGN KEY (referred_patient_id) REFERENCES patients (id) ON DELETE SET NULL
);
CREATE INDEX idx_patient_referrals_status ON patient_referrals (status);
CREATE INDEX idx_patient_referrals_referred_patient_id ON patient_referrals (referred_patient_id);
CREATE INDEX idx_patient_referrals_referring_patient_id ON patient_referrals (referring_patient_id);
CREATE INDEX idx_patient_referrals_organization_id ON patient_referrals (organization_id);

-- ------------------------------------------------------------------------
-- patient_teeth_chart   (src/patients/entities/patient-teeth-chart.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_teeth_chart (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id        uuid NOT NULL,
  location_id       uuid NOT NULL,
  dentist_id        uuid NOT NULL,
  organization_id   uuid NOT NULL,
  appointment_id    uuid,
  chart_data        jsonb NOT NULL DEFAULT '{}',
  periodontal_chart jsonb,
  notes             text,
  is_initial_chart  boolean NOT NULL DEFAULT false,
  recorded_at       timestamptz NOT NULL DEFAULT NOW(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_teeth_chart_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_teeth_chart_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_teeth_chart_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_teeth_chart_recorded_at ON patient_teeth_chart (recorded_at);
CREATE INDEX idx_patient_teeth_chart_organization_id ON patient_teeth_chart (organization_id);
CREATE INDEX idx_patient_teeth_chart_patient_id ON patient_teeth_chart (patient_id);

-- ------------------------------------------------------------------------
-- patient_visits   (src/patients/entities/patient-visit.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_visits (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id            uuid NOT NULL,
  location_id           uuid NOT NULL,
  organization_id       uuid NOT NULL,
  first_visit_date      date,
  last_visit_date       date,
  visit_count           integer NOT NULL DEFAULT 0,
  total_spent           numeric(12,2) NOT NULL DEFAULT 0,
  is_preferred_location boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_patient_visits_patient_id_location_id UNIQUE (patient_id, location_id),
  CONSTRAINT fk_patient_visits_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_visits_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_visits_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_visits_last_visit_date ON patient_visits (last_visit_date);
CREATE INDEX idx_patient_visits_organization_id ON patient_visits (organization_id);
CREATE INDEX idx_patient_visits_location_id ON patient_visits (location_id);
CREATE INDEX idx_patient_visits_patient_id ON patient_visits (patient_id);

-- ------------------------------------------------------------------------
-- patient_vitals   (src/patients/entities/patient-vitals.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE patient_vitals (
  id                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id                 uuid NOT NULL,
  location_id                uuid NOT NULL,
  organization_id            uuid NOT NULL,
  appointment_id             uuid,
  recorded_by                uuid NOT NULL,
  bp_systolic                integer,
  bp_diastolic               integer,
  pulse_rate                 integer,
  temperature                numeric(4,1),
  oxygen_saturation          integer,
  weight_kg                  numeric(5,2),
  height_cm                  numeric(5,2),
  bmi                        numeric(4,2),
  is_diabetic                boolean NOT NULL DEFAULT false,
  is_hypertensive            boolean NOT NULL DEFAULT false,
  is_pregnant                boolean NOT NULL DEFAULT false,
  is_on_blood_thinners       boolean NOT NULL DEFAULT false,
  is_on_antibiotics          boolean NOT NULL DEFAULT false,
  anesthesia_type            varchar(100),
  anesthesia_dose            varchar(100),
  anesthesia_administered_by uuid,
  notes                      text,
  recorded_at                timestamptz NOT NULL DEFAULT NOW(),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_patient_vitals_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_vitals_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_vitals_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_patient_vitals_recorded_at ON patient_vitals (recorded_at);
CREATE INDEX idx_patient_vitals_appointment_id ON patient_vitals (appointment_id);
CREATE INDEX idx_patient_vitals_organization_id ON patient_vitals (organization_id);
CREATE INDEX idx_patient_vitals_patient_id ON patient_vitals (patient_id);

-- ------------------------------------------------------------------------
-- treatment_plan_items   (src/patients/entities/treatment-plan-item.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE treatment_plan_items_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'postponed');
CREATE TABLE treatment_plan_items (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id            uuid NOT NULL,
  service_id         uuid,
  procedure_name     varchar(200) NOT NULL,
  procedure_code     varchar(20),
  tooth_number       varchar(10),
  tooth_surface      varchar(50),
  estimated_sessions integer NOT NULL DEFAULT 1,
  completed_sessions integer NOT NULL DEFAULT 0,
  estimated_cost     numeric(10,2),
  status             treatment_plan_items_status_enum NOT NULL DEFAULT 'pending',
  sequence_order     integer NOT NULL DEFAULT 1,
  assigned_to        uuid,
  clinical_notes     text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_treatment_plan_items_plan_id FOREIGN KEY (plan_id) REFERENCES patient_treatment_plans (id) ON DELETE CASCADE
);
CREATE INDEX idx_treatment_plan_items_plan_id_sequence_order ON treatment_plan_items (plan_id, sequence_order);
CREATE INDEX idx_treatment_plan_items_status ON treatment_plan_items (status);
CREATE INDEX idx_treatment_plan_items_plan_id ON treatment_plan_items (plan_id);

-- ------------------------------------------------------------------------
-- doctor_signatures   (src/prescriptions/entities/doctor-signature.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE doctor_signatures (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id         uuid NOT NULL,
  organization_id     uuid NOT NULL,
  signature_image_url text NOT NULL,
  signature_data      text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_doctor_signatures_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_doctor_signatures_employee_id ON doctor_signatures (employee_id);

-- ------------------------------------------------------------------------
-- prescription_history   (src/prescriptions/entities/prescription-history.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE prescription_history_change_type_enum AS ENUM ('CREATED', 'AMENDED', 'FINALIZED', 'PRINTED', 'SHARED');
CREATE TABLE prescription_history (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id uuid NOT NULL,
  version         integer NOT NULL,
  changed_by      uuid,
  change_type     prescription_history_change_type_enum NOT NULL,
  previous_data   jsonb,
  change_notes    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_prescription_history_prescription_id FOREIGN KEY (prescription_id) REFERENCES prescriptions (id) ON DELETE CASCADE
);
CREATE INDEX idx_prescription_history_prescription_id_created_at ON prescription_history (prescription_id, created_at);

-- ------------------------------------------------------------------------
-- prescription_medicines   (src/prescriptions/entities/prescription-medicine.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE prescription_medicines_meal_relation_enum AS ENUM ('BEFORE_MEAL', 'AFTER_MEAL', 'WITH_MEAL', 'EMPTY_STOMACH', 'NONE');
CREATE TABLE prescription_medicines (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id           uuid NOT NULL,
  medicine_directory_id     uuid,
  medicine_name             varchar(200) NOT NULL,
  medicine_name_urdu        varchar(200),
  type                      varchar(30),
  dosage                    varchar(50) NOT NULL,
  frequency                 varchar(100) NOT NULL,
  frequency_timing          jsonb NOT NULL DEFAULT '[]',
  meal_relation             prescription_medicines_meal_relation_enum NOT NULL DEFAULT 'NONE',
  duration                  varchar(50) NOT NULL,
  special_instructions      text,
  special_instructions_urdu text,
  sort_order                integer NOT NULL DEFAULT 0,
  CONSTRAINT fk_prescription_medicines_prescription_id FOREIGN KEY (prescription_id) REFERENCES prescriptions (id) ON DELETE CASCADE,
  CONSTRAINT fk_prescription_medicines_medicine_directory_id FOREIGN KEY (medicine_directory_id) REFERENCES medicine_directory (id) ON DELETE SET NULL
);
CREATE INDEX idx_prescription_medicines_prescription_id ON prescription_medicines (prescription_id);

-- ------------------------------------------------------------------------
-- prescription_preset_medicines   (src/prescriptions/entities/prescription-preset-medicine.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE prescription_preset_medicines_meal_relation_enum AS ENUM ('BEFORE_MEAL', 'AFTER_MEAL', 'WITH_MEAL', 'EMPTY_STOMACH', 'NONE');
CREATE TABLE prescription_preset_medicines (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id                 uuid NOT NULL,
  medicine_directory_id     uuid,
  medicine_name             varchar(200) NOT NULL,
  medicine_name_urdu        varchar(200),
  type                      varchar(30),
  dosage                    varchar(50) NOT NULL,
  frequency                 varchar(100) NOT NULL,
  frequency_timing          jsonb NOT NULL DEFAULT '[]',
  meal_relation             prescription_preset_medicines_meal_relation_enum NOT NULL DEFAULT 'NONE',
  duration                  varchar(50) NOT NULL,
  special_instructions      text,
  special_instructions_urdu text,
  sort_order                integer NOT NULL DEFAULT 0,
  CONSTRAINT fk_prescription_preset_medicines_preset_id FOREIGN KEY (preset_id) REFERENCES prescription_presets (id) ON DELETE CASCADE,
  CONSTRAINT fk_prescription_preset_medicines_medicine_directory_id FOREIGN KEY (medicine_directory_id) REFERENCES medicine_directory (id) ON DELETE SET NULL
);
CREATE INDEX idx_prescription_preset_medicines_preset_id ON prescription_preset_medicines (preset_id);

-- ------------------------------------------------------------------------
-- idempotency_keys   (src/queue/entities/idempotency-key.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE idempotency_keys (
  organization_id uuid NOT NULL,
  key             text NOT NULL,
  request_hash    text NOT NULL,
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, key)
);

-- ------------------------------------------------------------------------
-- outbox   (src/queue/entities/outbox-message.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE outbox (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL,
  topic           text NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);
CREATE INDEX outbox_unpublished ON outbox (id) WHERE "published_at" IS NULL;

-- ------------------------------------------------------------------------
-- queue_events   (src/queue/entities/queue-event.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE queue_events_from_status_enum AS ENUM ('waiting', 'called', 'in_consultation', 'on_hold', 'skipped', 'completed', 'cancelled', 'transferred', 'aborted');
CREATE TYPE queue_events_to_status_enum AS ENUM ('waiting', 'called', 'in_consultation', 'on_hold', 'skipped', 'completed', 'cancelled', 'transferred', 'aborted');
CREATE TABLE queue_events (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id    uuid NOT NULL,
  queue_session_id   uuid NOT NULL,
  queue_entry_id     uuid,
  seq                bigint NOT NULL,
  event_type         text NOT NULL,
  from_status        queue_events_from_status_enum,
  to_status          queue_events_to_status_enum,
  reason_code        text,
  reason_text        text,
  suggested_entry_id uuid,
  actor_id           uuid NOT NULL,
  actor_role         text NOT NULL,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_queue_event_session_seq UNIQUE (queue_session_id, seq)
);
CREATE INDEX idx_queue_events_organization_id_occurred_at ON queue_events (organization_id, occurred_at);

-- ------------------------------------------------------------------------
-- queue_policies   (src/queue/entities/queue-policy.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE queue_policies_skipped_rejoin_policy_enum AS ENUM ('end', 'original_position', 'manual');
CREATE TABLE queue_policies (
  id                            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id               uuid NOT NULL,
  location_id                   uuid,
  smart_queue_enabled           boolean NOT NULL DEFAULT false,
  early_window_min              integer NOT NULL DEFAULT 15,
  late_grace_min                integer NOT NULL DEFAULT 10,
  max_late_min                  integer NOT NULL DEFAULT 45,
  walkin_starvation_min         integer NOT NULL DEFAULT 45,
  skipped_rejoin_policy         queue_policies_skipped_rejoin_policy_enum NOT NULL DEFAULT 'end',
  call_timeout_sec              integer,
  manual_select_reason_required boolean NOT NULL DEFAULT false,
  service_day_cutoff            time NOT NULL DEFAULT '00:00',
  version                       integer NOT NULL DEFAULT 0,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_queue_policies_1 CHECK ("max_late_min" >= "late_grace_min"),
  CONSTRAINT chk_queue_policies_2 CHECK ("call_timeout_sec" IS NULL OR "call_timeout_sec" >= 30),
  CONSTRAINT chk_queue_policies_3 CHECK ("walkin_starvation_min" > 0),
  CONSTRAINT chk_queue_policies_4 CHECK ("late_grace_min" >= 0),
  CONSTRAINT chk_queue_policies_5 CHECK ("early_window_min" BETWEEN 0 AND 240)
);
CREATE UNIQUE INDEX uq_queue_policy_location ON queue_policies (organization_id, location_id) WHERE "location_id" IS NOT NULL;
CREATE UNIQUE INDEX uq_queue_policy_org_default ON queue_policies (organization_id) WHERE "location_id" IS NULL;

-- ------------------------------------------------------------------------
-- user_sessions   (src/session/entities/user-session.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE user_sessions (
  uuid               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid NOT NULL,
  refresh_token_hash varchar(255) NOT NULL,
  expires_at         timestamptz NOT NULL,
  is_revoked         boolean NOT NULL DEFAULT false,
  user_agent         text,
  device             varchar(255),
  browser            varchar(100),
  os                 varchar(100),
  ip_address         varchar(45),
  location           varchar(255),
  is_current         boolean NOT NULL DEFAULT false,
  auth_method        varchar(16) NOT NULL DEFAULT 'password',
  auth_domain        varchar(255),
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_active_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE
);
CREATE INDEX idx_user_sessions_user_id_is_revoked ON user_sessions (user_id, is_revoked);

-- ------------------------------------------------------------------------
-- desktop_auth_handoffs   (src/auth/entities/DesktopAuthHandoff.ts)
-- ------------------------------------------------------------------------
CREATE TABLE desktop_auth_handoffs (
  uuid        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL,
  code_hash   varchar(64) NOT NULL,
  state       varchar(128) NOT NULL,
  auth_domain varchar(255),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_desktop_auth_handoffs_user_id
    FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_desktop_auth_handoffs_code_hash ON desktop_auth_handoffs (code_hash);
CREATE INDEX idx_desktop_auth_handoffs_expires_at ON desktop_auth_handoffs (expires_at);

-- ------------------------------------------------------------------------
-- config_values   (src/settings-registry/entities/config-value.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE config_values_scope_type_enum AS ENUM ('platform', 'org', 'location');
CREATE TABLE config_values (
  id         uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
  scope_type config_values_scope_type_enum NOT NULL,
  scope_id   uuid,
  key        varchar(100) NOT NULL,
  value      jsonb,
  is_locked  boolean NOT NULL DEFAULT false,
  version    integer NOT NULL DEFAULT 1,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_config_values_platform_key ON config_values (key) WHERE "scope_type" = 'platform';
CREATE UNIQUE INDEX uq_config_values_scope_key ON config_values (scope_type, scope_id, key);

-- ------------------------------------------------------------------------
-- subscription_payments   (src/subscriptions/entities/subscription-payment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TYPE subscription_payments_plan_enum AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TABLE subscription_payments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  plan            subscription_payments_plan_enum NOT NULL,
  months          integer NOT NULL,
  amount          numeric(12,2) NOT NULL,
  method          varchar(30) NOT NULL,
  reference       varchar(120),
  paid_at         timestamptz NOT NULL,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  notes           text,
  recorded_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_subscription_payments_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);
CREATE INDEX idx_subscription_payments_organization_id_paid_at ON subscription_payments (organization_id, paid_at);

-- ------------------------------------------------------------------------
-- treatments   (src/treatments/entities/treatment.entity.ts)
-- ------------------------------------------------------------------------
CREATE TABLE treatments (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id       uuid NOT NULL,
  encounter_id     uuid,
  plan_template_id uuid,
  organization_id  uuid NOT NULL,
  location_id      uuid NOT NULL,
  treatment_name   varchar(200) NOT NULL,
  notes            text,
  cost             numeric(12,2),
  plan_item_id     uuid,
  service_id       uuid,
  date             timestamptz NOT NULL,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_treatments_patient_id FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_treatments_encounter_id FOREIGN KEY (encounter_id) REFERENCES patient_encounters (id) ON DELETE SET NULL,
  CONSTRAINT fk_treatments_plan_template_id FOREIGN KEY (plan_template_id) REFERENCES plan_templates (id) ON DELETE SET NULL,
  CONSTRAINT fk_treatments_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_treatments_location_id FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
);
CREATE INDEX idx_treatments_encounter_id ON treatments (encounter_id);
CREATE INDEX idx_treatments_patient_id ON treatments (patient_id);
CREATE INDEX idx_treatments_location_id ON treatments (location_id);
CREATE INDEX idx_treatments_organization_id ON treatments (organization_id);
