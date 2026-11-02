# Entity catalog

Data model of the clinic management backend (`backend/src`), derived from code only — no database was opened.
Generated 2026-10-24 from the TypeORM entity classes plus the three files in `src/migrations/`.

**Legend.** **VERIFIED** = read directly from code (entity decorators, migration SQL, or an entity source comment).
**INFERRED** = a conclusion drawn from names or conventions; the code does not state it. Everything in the column, index, key and
FK tables below is VERIFIED unless the row says INFERRED.

## Contents

1. [Schema source of truth](#1-schema-source-of-truth)
2. [Entities vs migrations — every difference](#2-entities-vs-migrations--every-difference)
3. [Database objects that are not in entities](#3-database-objects-that-are-not-in-entities)
4. [Module index](#4-module-index)
5. [Entities by module](#5-entities-by-module)
6. [Relationships — FK-enforced](#6-relationships--fk-enforced)
7. [Relationships — logical only (no FK)](#7-relationships--logical-only-no-fk)
8. [Tenant scope](#8-tenant-scope)
9. [Ownership — unclear or shared](#9-ownership--unclear-or-shared)
10. [Ambiguities and open questions](#10-ambiguities-and-open-questions)

## 1. Schema source of truth

| Source | Role | Evidence |
|---|---|---|
| **TypeORM entity classes** (`src/**/*.entity.ts`, `src/auth/entities/*.ts`) | **Source of truth for tables, columns, PK/FK, unique, index, CHECK and EXCLUDE constraints.** Dev: `synchronize: true` builds the schema from them on API start. Prod: `schema:sync:prod` applies the entity diff after review. | VERIFIED — `app.module.ts` (`synchronize: ownsSchema && NODE_ENV !== 'production'`, `autoLoadEntities: true`), `docs/database-migrations.md` |
| `src/migrations/1792403456699-doctor-compensation.ts` | Hand-written, idempotent. Creates commission tables only if missing; always installs the `commission_entries` append-only trigger and backfills. | VERIFIED |
| `src/migrations/1792490000000-lab-management-foundation.ts` | Hand-written, idempotent. Creates `audit_logs`, `status_history`, `number_sequences`, `labs`, `lab_members`, `lab_clinic_links` if missing; installs `uuid_generate_v7()` and append-only triggers. | VERIFIED |
| `src/migrations/1776356529788-create-table.ts` | **Legacy baseline — never executed.** Recorded as applied by `recordLegacyBaseline`. Partial diff against an early dev DB; describes a schema that no longer exists. | VERIFIED — `common/database/migrations.ts`, `docs/database-migrations.md` |
| `common/database/ensure-extensions.ts`, `uuid-v7.ts` | Installs `btree_gist` and `uuid_generate_v7()` before synchronize. | VERIFIED |

**How this catalog was built.** The entity classes were loaded with ts-node and TypeORM `DataSource.buildMetadatas()` was called
without connecting. That yields the same resolved metadata `synchronize` uses: database column names, normalized types, nullability, defaults, generated
FK / index / unique / check / exclusion definitions with their names and `ON DELETE` actions. So the tables below are what `synchronize` would build,
not a hand transcription. Entity source comments were read with the TypeScript compiler API.

**Counts.** 153 entity classes → 153 tables, in 133 files. No views, no table inheritance, no ManyToMany junction tables, no relation declared with `createForeignKeyConstraints: false`.
No Mongoose schemas are used in `src/` (the `@nestjs/mongoose` dependency is unused).

**Runtime registration.** The app uses `autoLoadEntities`, so only entities passed to some `TypeOrmModule.forFeature([...])` exist in the running app's schema.
Not registered by any module (exist only for the CLI data source glob, e.g. `schema:sync:prod` / `migration:generate`): `Chair` (`chairs`), `Inventory` (`inventory`). VERIFIED.
This means the dev database (synchronize via the app) and a prod database (schema:sync via the CLI glob) can differ by these tables.

## 2. Entities vs migrations — every difference

Compared programmatically: every `CREATE TABLE`, `ALTER TABLE … ADD`, `ADD CONSTRAINT` and `CREATE INDEX` in each migration's `up()` against the entity metadata.
Formatting-only differences are left out (TypeORM writes `timestamp` for `timestamp without time zone`; PKs from `@PrimaryGeneratedColumn('uuid')` show their
`uuid_generate_v4()` default through the generation strategy, not as a column default; `DEFAULT 1` vs `DEFAULT '1'` on integer columns).

### 2.1 `1792403456699-doctor-compensation` (hand-written)

Entities changed after this migration was written. On a database where this migration created the tables (synchronize off), `schema:sync:prod` must add the rest. VERIFIED.

| Table | Difference | Migration | Entity |
|---|---|---|---|
| `commission_entries` | `charge_id` nullability | `NOT NULL` | nullable |
| `commission_entries` | column `lab_invoice_line_id` | absent | `uuid`, nullable, FK → `lab_invoice_lines` |
| `commission_entries` | CHECK `chk_commission_entries_target` | absent | present |
| `commission_entries` | index `idx_commission_entries_lab_line (lab_invoice_line_id)` | absent | present |
| `commission_entries` | unique index `uq_commission_entries_lab_source (source_type, source_id, lab_invoice_line_id)` | absent | present |
| `payroll_records` | unique key | drops `UQ_2523104f…(employee_id, month, year)`, adds `UQ_ab131112…(employee_id, location_id, month, year)` | matches the new key |

### 2.2 `1792490000000-lab-management-foundation` (hand-written)

| Table | Difference | Migration | Entity |
|---|---|---|---|
| `audit_logs` | column `subject_id` | absent | `uuid`, nullable |
| `audit_logs` | index `idx_audit_logs_subject (subject_id, created_at)` | absent | present |
| `status_history` | column `subject_id` | absent | `uuid`, nullable |
| `status_history` | index `idx_status_history_subject (subject_id, created_at)` | absent | present |

Everything else in both hand-written migrations (columns, types, nullability, defaults, CHECK / EXCLUDE names, FK targets and `ON DELETE`) matches the entities. VERIFIED.

### 2.3 `1776356529788-create-table` (legacy baseline, never executed)

It describes 17 tables. Because it never runs, none of these differences affect a real database; they are listed for completeness. VERIFIED.

| Table | Differences (migration → current entity) |
|---|---|
| `organization_admins`, `user_locations`, `super_admin_access_log` | Tables exist only in the baseline. No entity. (Replaced by `organization_ownership` and `employee_org_location_assignments`; INFERRED.) |
| `users` | Entity adds `email_verification_token`, `email_verification_expires`, `email_verified_at`. |
| `organizations` | Entity adds `clinic_type`, `specialty_tags`, `timezone`, `currency`, `max_locations`, `max_users`, `trial_ends_at`, `paid_until`, `onboarding_pending`, `access_version`. |
| `patients` | Baseline has `patient_id` (unique), `emergency_name/phone/relation`, `referred_by`, unique `phone`, index on `is_active`. Entity replaces them with `patient_number` (unique per org), `emergency_contact_*`, `referred_by_text`; `phone` is no longer unique; `allergies` changed `jsonb NOT NULL DEFAULT '[]'` → `text NULL`; `full_name`/`email` 255 → 150, `occupation` 255 → 100; entity adds `marital_status`, `cnic`, `whatsapp_number`, `preferred_language`, `communication_pref`, `primary_location_id` (FK), `source`, `profile_picture_url`, `is_minor`, `guardian_*`, `internal_notes`, `tags`, `is_blacklisted`, `blacklist_reason`, `created_by`, `deleted_at`, plus new indexes. |
| `patient_visits` | Baseline `first_visit_date`/`last_visit_date` are `timestamptz`, entity `date`; baseline `preferred` → entity `is_preferred_location`; entity adds `organization_id` (FK), `total_spent`; index set differs. |
| `locations` | Entity adds `token_prefix`, `business_model`. |
| `location_settings` | Entity adds `organization_id` (FK). |
| `employees` | Baseline has `location_id`, `user_id` (both FK), `designation`, `specialization`, `experience_years`, `joining_date`. Entity is a person record: `full_name`, `phone` (unique), `cnic` (unique), `gender`, `dob`, `profile_picture_url`. Org/location data moved to `employee_org_location_assignments`. |
| `employee_schedules` | `start_time`/`end_time` NOT NULL → nullable; entity adds `organization_id` (FK), `is_working`, `created_by`, timestamps, unique `(employee_id, location_id, day_of_week)`. |
| `appointments` | Baseline `employee_id` (FK), `chair_id` (FK), `title`, `is_walk_in` → entity `doctor_id` (FK → employees), no chair link; entity adds `reason_for_visit`, `is_emergency`, `cancel_reason_code`, `cancel_reason`, `checked_in_at`, `completed_at`, `cancelled_at`, `no_show_at`, EXCLUDE `no_doctor_overlap`. |
| `invoices` | Baseline is a simple invoice (`appointment_id`, `amount`, `payment_date`, status default `'draft'`, `organization_id`/`location_id` FKs, patient FK `ON DELETE CASCADE`). Entity is billing v2: `invoice_number` (unique per org), `revision`, totals columns, `issued_*`/`cancelled_*`, status default `'ISSUED'`, timestamptz; **org and location FKs are gone** and patient FK is `ON DELETE RESTRICT`. |
| `user_sessions`, `security_logs`, `chairs`, `inventory` | Only formatting differences. |

**Tables with no migration at all.** The other 136 tables are created only by `synchronize` / `schema:sync` from the entities. This is the documented design, not a defect, but it means the migration folder cannot be used to reconstruct the schema. VERIFIED.

## 3. Database objects that are not in entities

| Object | Kind | Where defined | Notes |
|---|---|---|---|
| `btree_gist` | extension | `ensure-extensions.ts`, doctor-compensation migration | Needed by GiST EXCLUDE constraints with `uuid =` (`appointments.no_doctor_overlap`, `compensation_plans`, `lab_service_prices`). VERIFIED |
| `uuid_generate_v7()` | SQL function | `uuid-v7.ts`, lab-management migration | PK default of the lab-management tables (`UuidV7PrimaryColumn`). VERIFIED |
| `commission_entries_append_only()` + `trg_commission_entries_append_only` | trigger | doctor-compensation migration | Blocks DELETE; blocks UPDATE except setting / releasing `settlement_id` while the settlement is PENDING. VERIFIED |
| `reject_append_only_mutation()` + `trg_audit_logs_append_only`, `trg_status_history_append_only` | trigger | lab-management migration | Blocks UPDATE and DELETE. VERIFIED |
| `migrations` | table | `common/database/migrations.ts` | TypeORM migration bookkeeping. VERIFIED |

No row-level security policies, views or other triggers are defined anywhere in `src/`. VERIFIED (searched for `CREATE TRIGGER`, `CREATE POLICY`, `ROW LEVEL SECURITY`, `CREATE TABLE`, `ALTER TABLE` outside migrations).

## 4. Module index

Owning module = the Nest module folder whose `entities/` directory defines the class. Each entity has exactly one owner.

| # | Module (folder) | Nest module | Entities | Tables |
|---|---|---|---|---|
| 1 | `user` | UserModule | 1 | [`users`](#users) |
| 2 | `auth` | AuthModule | 2 | [`oauth_providers`](#oauth-providers), [`security_logs`](#security-logs) |
| 3 | `session` | SessionModule | 1 | [`user_sessions`](#user-sessions) |
| 4 | `organizations` | OrganizationsModule | 3 | [`organization_ownership`](#organization-ownership), [`organization_settings`](#organization-settings), [`organizations`](#organizations) |
| 5 | `locations` | LocationsModule | 2 | [`location_settings`](#location-settings), [`locations`](#locations) |
| 6 | `access` | AccessModule (+ NavLayoutsModule) | 1 | [`nav_layouts`](#nav-layouts) |
| 7 | `feature-flags` | FeatureFlagsModule | 3 | [`feature_catalog`](#feature-catalog), [`location_feature_overrides`](#location-feature-overrides), [`org_feature_flags`](#org-feature-flags) |
| 8 | `settings-registry` | SettingsRegistryModule | 1 | [`config_values`](#config-values) |
| 9 | `subscriptions` | SubscriptionsModule | 1 | [`subscription_payments`](#subscription-payments) |
| 10 | `employees` | EmployeesModule | 6 | [`doctor_availability_overrides`](#doctor-availability-overrides), [`employee_leaves`](#employee-leaves), [`employee_org_location_assignments`](#employee-org-location-assignments), [`employee_schedules`](#employee-schedules), [`employees`](#employees), [`employment_roles`](#employment-roles) |
| 11 | `payroll` | PayrollModule | 1 | [`payroll_records`](#payroll-records) |
| 12 | `patients` | PatientsModule | 15 | [`patient_communications`](#patient-communications), [`patient_consents`](#patient-consents), [`patient_dental_info`](#patient-dental-info), [`patient_documents`](#patient-documents), [`patient_feedback`](#patient-feedback), [`patient_insurance`](#patient-insurance), [`patient_prescriptions`](#patient-prescriptions), [`patient_recalls`](#patient-recalls), [`patient_referrals`](#patient-referrals), [`patient_teeth_chart`](#patient-teeth-chart), [`patient_treatment_plans`](#patient-treatment-plans), [`patient_visits`](#patient-visits), [`patient_vitals`](#patient-vitals), [`patients`](#patients), [`treatment_plan_items`](#treatment-plan-items) |
| 13 | `appointments` | AppointmentsModule | 1 | [`appointments`](#appointments) |
| 14 | `queue` | QueueModule / QueueRuntimeModule | 6 | [`idempotency_keys`](#idempotency-keys), [`outbox`](#outbox), [`queue_entries`](#queue-entries), [`queue_events`](#queue-events), [`queue_policies`](#queue-policies), [`queue_sessions`](#queue-sessions) |
| 15 | `encounters` | EncountersModule | 1 | [`patient_encounters`](#patient-encounters) |
| 16 | `treatments` | TreatmentsModule | 1 | [`treatments`](#treatments) |
| 17 | `plan-templates` | PlanTemplatesModule | 1 | [`plan_templates`](#plan-templates) |
| 18 | `prescriptions` | PrescriptionsModule | 8 | [`doctor_signatures`](#doctor-signatures), [`medicine_directory`](#medicine-directory), [`prescription_history`](#prescription-history), [`prescription_medicines`](#prescription-medicines), [`prescription_templates`](#prescription-templates), [`prescriptions`](#prescriptions), [`treatment_plan_template_medicines`](#treatment-plan-template-medicines), [`treatment_plan_templates`](#treatment-plan-templates) |
| 19 | `engine` | EngineModule | 12 | [`form_schema_versions`](#form-schema-versions), [`form_schemas`](#form-schemas), [`organization_specialties`](#organization-specialties), [`specialties`](#specialties), [`stage_template_steps`](#stage-template-steps), [`stage_templates`](#stage-templates), [`transition_effects`](#transition-effects), [`workflow_effects`](#workflow-effects), [`workflow_states`](#workflow-states), [`workflow_template_versions`](#workflow-template-versions), [`workflow_templates`](#workflow-templates), [`workflow_transitions`](#workflow-transitions) |
| 20 | `billing` | BillingModule (+ GeneralLedgerModule) | 25 | [`billing_audit_logs`](#billing-audit-logs), [`cash_close_lines`](#cash-close-lines), [`cash_closes`](#cash-closes), [`charges`](#charges), [`commission_entries`](#commission-entries), [`commission_rules`](#commission-rules), [`commission_settlements`](#commission-settlements), [`compensation_plans`](#compensation-plans), [`credit_packages`](#credit-packages), [`discount_types`](#discount-types), [`document_sequences`](#document-sequences), [`expenses`](#expenses), [`invoices`](#invoices), [`ledger_entries`](#ledger-entries), [`ledger_journal_lines`](#ledger-journal-lines), [`ledger_journals`](#ledger-journals), [`location_billing_settings`](#location-billing-settings), [`patient_credits`](#patient-credits), [`payment_accounts`](#payment-accounts), [`payment_allocations`](#payment-allocations), [`payments`](#payments), [`refund_sources`](#refund-sources), [`refunds`](#refunds), [`service_prices`](#service-prices), [`services`](#services) |
| 21 | `inventory` | InventoryModule | 11 | [`consumption_template_items`](#consumption-template-items), [`consumption_templates`](#consumption-templates), [`inventory`](#inventory), [`inventory_categories`](#inventory-categories), [`inventory_items`](#inventory-items), [`patient_consumption_items`](#patient-consumption-items), [`patient_consumptions`](#patient-consumptions), [`purchase_order_items`](#purchase-order-items), [`purchase_orders`](#purchase-orders), [`stock_movements`](#stock-movements), [`suppliers`](#suppliers) |
| 22 | `chairs` | — (no Nest module) | 1 | [`chairs`](#chairs) |
| 23 | `notifications` | NotificationsModule / NotificationsRuntimeModule | 7 | [`notification_audience_settings`](#notification-audience-settings), [`notification_events`](#notification-events), [`notification_outbox`](#notification-outbox), [`notification_rules`](#notification-rules), [`notification_templates`](#notification-templates), [`patient_comm_prefs`](#patient-comm-prefs), [`user_notifications`](#user-notifications) |
| 24 | `labs` | LabsModule | 3 | [`lab_clinic_links`](#lab-clinic-links), [`lab_members`](#lab-members), [`labs`](#labs) |
| 25 | `lab-access` | LabAccessModule | 1 | [`magic_links`](#magic-links) |
| 26 | `lab-catalog` | LabCatalogModule | 6 | [`lab_service_options`](#lab-service-options), [`lab_service_prices`](#lab-service-prices), [`lab_services`](#lab-services), [`order_templates`](#order-templates), [`service_categories`](#service-categories), [`service_mappings`](#service-mappings) |
| 27 | `lab-orders` | LabOrdersModule | 9 | [`attachments`](#attachments), [`dental_item_details`](#dental-item-details), [`item_form_responses`](#item-form-responses), [`item_teeth`](#item-teeth), [`lab_order_items`](#lab-order-items), [`lab_orders`](#lab-orders), [`order_charge_requests`](#order-charge-requests), [`order_messages`](#order-messages), [`order_revisions`](#order-revisions) |
| 28 | `lab-production` | LabProductionModule | 6 | [`item_assignments`](#item-assignments), [`item_warranties`](#item-warranties), [`order_item_stages`](#order-item-stages), [`remake_requests`](#remake-requests), [`shipment_items`](#shipment-items), [`shipments`](#shipments) |
| 29 | `lab-billing` | LabBillingModule | 8 | [`lab_billing_settings`](#lab-billing-settings), [`lab_credit_notes`](#lab-credit-notes), [`lab_invoice_lines`](#lab-invoice-lines), [`lab_invoices`](#lab-invoices), [`lab_payment_allocations`](#lab-payment-allocations), [`lab_payments`](#lab-payments), [`lab_refund_sources`](#lab-refund-sources), [`lab_refunds`](#lab-refunds) |
| 30 | `lab-payables` | LabPayablesModule | 6 | [`lab_statement_lines`](#lab-statement-lines), [`lab_statements`](#lab-statements), [`vendor_bill_lines`](#vendor-bill-lines), [`vendor_bills`](#vendor-bills), [`vendor_payment_allocations`](#vendor-payment-allocations), [`vendor_payments`](#vendor-payments) |
| 31 | `common` | AuditModule / SequencesModule (common/) | 3 | [`audit_logs`](#audit-logs), [`number_sequences`](#number-sequences), [`status_history`](#status-history) |
| | **Total** | | **153** | |

## 5. Entities by module

Per entity: file, PK, tenant scope, timestamps, soft delete. Then columns, keys, indexes, constraints, FKs and logical references.
Column flags: **PK** primary key, **FK** foreign key (enforced), **UQ** unique on its own, **L** logical reference (no FK). Types are PostgreSQL types as `synchronize` creates them.

### Module `user`

<a id="users"></a>
#### `User` → `users`

- **File:** `src/user/entities/user.entity.ts`
- **PK:** `uuid` (uuid, generated: uuid)
- **Tenant scope:** global — platform identity (one user, many orgs)
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `uuid` | uuid | uuid | no | generated (uuid) | PK |  |
| `email` | email | character varying(255) | no |  | UQ |  |
| `name` | name | character varying(255) | yes |  |  |  |
| `phone` | phone | character varying(20) | yes |  |  |  |
| `avatar_url` | avatarUrl | character varying(500) | yes |  |  |  |
| `password` | password | character varying(255) | yes |  |  |  |
| `password_reset_token` | passwordResetToken | character varying | yes |  |  |  |
| `password_reset_expires` | passwordResetExpires | timestamp with time zone | yes |  |  |  |
| `email_verification_token` | emailVerificationToken | character varying(64) | yes |  |  | Pending email verification: sha256 of the emailed token. Set only for self-signups, so existing and admin-created accounts are never asked. |
| `email_verification_expires` | emailVerificationExpires | timestamp with time zone | yes |  |  |  |
| `email_verified_at` | emailVerifiedAt | timestamp with time zone | yes |  |  |  |
| `provider` | provider | enum(google, github, local) | no | 'local' |  |  |
| `refresh_token` | refreshToken | character varying | yes |  |  | @deprecated Use session-specific refresh tokens instead. Kept for backward compatibility during migration period. |
| `global_role` | globalRole | enum(super_admin) | yes |  |  | Global role — only super_admin has a value here. Normal users have null (their access is determined by organization_admins / user_locations… |
| `status` | status | enum(active, suspended, deleted) | no | 'active' |  | Account status for lifecycle management. Controls what actions the user can perform. |
| `last_accessed_organization_id` | lastAccessedOrganizationId | uuid | yes |  | L | Last accessed organization — for UX continuity. |
| `last_accessed_location_id` | lastAccessedLocationId | uuid | yes |  | L | Last accessed location — for UX continuity. |
| `deleted_at` | deletedAt | timestamp with time zone | yes |  |  | Timestamp when account was soft-deleted. |
| `suspended_at` | suspendedAt | timestamp with time zone | yes |  |  | Timestamp when account was suspended. |
| `suspension_reason` | suspensionReason | text | yes |  |  | Reason for account suspension. |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_97672ac88f789774dd47f7c8be3` (email)
- INDEX `IDX_3676155292d72c67cd4e090514` (status)

Logical references (no FK):

- `last_accessed_organization_id` → organizations — INFERRED (entity comment states target)
- `last_accessed_location_id` → locations — INFERRED (entity comment states target)

### Module `auth`

<a id="oauth-providers"></a>
#### `OAuthProvider` → `oauth_providers`

> OAuthProvider Entity Tracks linked OAuth providers per user. Allows users to link multiple providers (Google, GitHub, etc.) to a single account.

- **File:** `src/auth/entities/OAuthProvider.ts`
- **PK:** `uuid` (uuid, generated: uuid)
- **Tenant scope:** global — per user
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `uuid` | uuid | uuid | no | generated (uuid) | PK |  |
| `user_id` | userId | uuid | no |  | FK→`users` |  |
| `provider` | provider | enum(google, github, local) | no |  |  | OAuth provider (Google, GitHub, etc.) |
| `provider_id` | providerId | character varying(255) | no |  |  | Unique ID from the OAuth provider. |
| `email` | email | character varying(255) | yes |  |  | Email associated with this OAuth account. May differ from user's primary email. |
| `display_name` | displayName | character varying(255) | yes |  |  | Display name from OAuth provider. |
| `avatar_url` | avatarUrl | character varying(500) | yes |  |  | Avatar URL from OAuth provider. |
| `profile_data` | profileData | jsonb | no | '{}' |  | Raw profile data from OAuth provider. |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_565c37d4d8f04c7e04455283e75` (user_id, provider)
- INDEX `IDX_0d0fa28b80946305f0b7417526` (provider, provider_id)

Foreign keys (enforced):

- (user_id) → `users`(uuid) ON DELETE CASCADE — `user` (many-to-one)

<a id="security-logs"></a>
#### `SecurityLog` → `security_logs`

> SecurityLog Entity Audit logging for security-related events. Tracks all authentication, session, and account events.

- **File:** `src/auth/entities/SecurityLog.ts`
- **PK:** `uuid` (uuid, generated: uuid)
- **Tenant scope:** global — per user/session
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `uuid` | uuid | uuid | no | generated (uuid) | PK |  |
| `user_id` | userId | uuid | yes |  | FK→`users` |  |
| `event_type` | eventType | enum(LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, LOGOUT_ALL, PASSWORD_CHANGE, PASSWORD_RESET_REQUEST, PASSWORD_RESET_SUCCESS, EMAIL_VERIFICATION_SENT, EMAIL_VERIFIED, SESSION_CREATED, SESSION_REVOKED, SESSION_EXPIRED, TOKEN_REFRESHED, OAUTH_LINK, OAUTH_UNLINK, ACCOUNT_SUSPENDED, ACCOUNT_DELETED, ACCOUNT_RESTORED, NEW_DEVICE_LOGIN, SUSPICIOUS_ACTIVITY) | no |  |  | Type of security event. |
| `ip_address` | ipAddress | character varying(45) | yes |  |  | IP address from which the event originated. |
| `user_agent` | userAgent | text | yes |  |  | User agent string for device identification. |
| `metadata` | metadata | jsonb | no | '{}' |  | Additional metadata about the event. Stores context-specific information in JSON format. |
| `session_id` | sessionId | uuid | yes |  | L | Optional session ID if event is session-related. |
| `success` | success | boolean | no | true |  | Whether the event was successful. |
| `error_message` | errorMessage | text | yes |  |  | Error message if the event failed. |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_b4bbd742cc4520d66a4378998b` (created_at)
- INDEX `IDX_31abffa0dcd252c7ef1513692e` (user_id, event_type)

Foreign keys (enforced):

- (user_id) → `users`(uuid) ON DELETE SET NULL — `user` (many-to-one)

Logical references (no FK):

- `session_id` → user_sessions — INFERRED (entity comment states target)

### Module `session`

<a id="user-sessions"></a>
#### `UserSession` → `user_sessions`

> UserSession Entity Tracks active user sessions for security management. Each session has its own refresh token for multi-device support.

- **File:** `src/session/entities/user-session.entity.ts`
- **PK:** `uuid` (uuid, generated: uuid)
- **Tenant scope:** global — per user
- **Timestamps:** `created_at` (create), `last_active_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `uuid` | uuid | uuid | no | generated (uuid) | PK |  |
| `user_id` | userId | uuid | no |  | FK→`users` |  |
| `refresh_token_hash` | refreshTokenHash | character varying(255) | no |  |  | Hashed refresh token for this specific session. Each session has a unique refresh token. |
| `expires_at` | expiresAt | timestamp with time zone | no |  |  | Session expiration timestamp. After this time, the session is considered expired. |
| `is_revoked` | isRevoked | boolean | no | false |  | Soft revocation flag. When true, the session is no longer valid. |
| `user_agent` | userAgent | text | yes |  |  | Full user agent string for detailed device identification. |
| `device` | device | character varying(255) | yes |  |  |  |
| `browser` | browser | character varying(100) | yes |  |  |  |
| `os` | os | character varying(100) | yes |  |  |  |
| `ip_address` | ipAddress | character varying(45) | yes |  |  |  |
| `location` | location | character varying(255) | yes |  |  |  |
| `is_current` | isCurrent | boolean | no | false |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `last_active_at` | lastActiveAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_ead56a334d703fe8605f173b44` (user_id, is_revoked)

Foreign keys (enforced):

- (user_id) → `users`(uuid) ON DELETE CASCADE — `user` (many-to-one)

### Module `organizations`

<a id="organization-ownership"></a>
#### `OrganizationOwnership` → `organization_ownership`

- **File:** `src/organizations/entities/organization-ownership.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `user_id` | userId | uuid | no |  | FK→`users` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `is_primary_owner` | isPrimaryOwner | boolean | no | false |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_9e63a489464140b82179bdf5bec` (user_id, organization_id)
- INDEX `IDX_9e63a489464140b82179bdf5be` (user_id, organization_id)

Foreign keys (enforced):

- (user_id) → `users`(uuid) ON DELETE CASCADE — `user` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="organization-settings"></a>
#### `OrganizationSettings` → `organization_settings`

- **File:** `src/organizations/entities/organization-settings.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` UQ |  |
| `feature_appointments` | featureAppointments | boolean | no | true |  |  |
| `feature_inventory` | featureInventory | boolean | no | true |  |  |
| `feature_finance` | featureFinance | boolean | no | true |  |  |
| `feature_reminders` | featureReminders | boolean | no | true |  |  |
| `feature_whatsapp` | featureWhatsapp | boolean | no | false |  |  |
| `feature_patient_portal` | featurePatientPortal | boolean | no | false |  |  |
| `allow_location_override` | allowLocationOverride | boolean | no | true |  |  |
| `default_slot_duration` | defaultSlotDuration | integer | no | '30' |  |  |
| `advance_booking_days` | advanceBookingDays | integer | no | '30' |  |  |
| `cancellation_notice_hours` | cancellationNoticeHours | integer | no | '24' |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_5fbdacce9bdcb454877d068e355` (organization_id)
- UNIQUE `REL_5fbdacce9bdcb454877d068e35` (organization_id)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (one-to-one)

<a id="organizations"></a>
#### `Organization` → `organizations`

- **File:** `src/organizations/entities/organization.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** global — the tenant root itself
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `name` | name | character varying(255) | no |  |  |  |
| `slug` | slug | character varying(255) | no |  | UQ |  |
| `email` | email | character varying(255) | yes |  |  |  |
| `phone` | phone | character varying(20) | yes |  |  |  |
| `website` | website | character varying(500) | yes |  |  |  |
| `subscription_plan` | subscriptionPlan | enum(free, starter, professional, enterprise) | no | 'free' |  |  |
| `clinic_type` | clinicType | character varying(100) | yes |  |  |  |
| `specialty_tags` | specialtyTags | jsonb | no | '["general"]' |  | Clinic specialties for feature relevance: general, dental, skin, ortho, physio, eye |
| `timezone` | timezone | character varying(100) | no | 'Asia/Karachi' |  |  |
| `currency` | currency | character varying(10) | no | 'PKR' |  |  |
| `max_locations` | maxLocations | integer | yes |  |  |  |
| `max_users` | maxUsers | integer | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `trial_ends_at` | trialEndsAt | timestamp with time zone | yes |  |  | Subscription (see src/subscriptions). Both null = an unmanaged clinic (created by a super admin before subscriptions existed): no expiry an… |
| `paid_until` | paidUntil | timestamp with time zone | yes |  |  |  |
| `onboarding_pending` | onboardingPending | boolean | no | false |  | Self-signup clinics go through the setup wizard once (`/setup`). |
| `access_version` | accessVersion | integer | no | '1' |  | +1 on every access change in the org (roles, assignments, feature flags, ownership); access caches key on it. Written only by AccessVersion… |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_963693341bd612aa01ddf3a4b68` (slug)
- INDEX `IDX_a3d861e393299a217b9fc05dd4` (is_active)

### Module `locations`

<a id="location-settings"></a>
#### `LocationSettings` → `location_settings`

- **File:** `src/locations/entities/location-settings.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` UQ |  |
| `organization_id` | organizationId | uuid | yes |  | FK→`organizations` |  |
| `appointment_slot_duration` | appointmentSlotDuration | integer | no | '30' |  |  |
| `max_appointments_per_day` | maxAppointmentsPerDay | integer | no | '50' |  |  |
| `advance_booking_days` | advanceBookingDays | integer | no | '30' |  |  |
| `cancellation_notice_hours` | cancellationNoticeHours | integer | no | '24' |  |  |
| `reminder_enabled` | reminderEnabled | boolean | no | true |  |  |
| `reminder_days_before` | reminderDaysBefore | integer | no | '1' |  |  |
| `reminder_hours_before` | reminderHoursBefore | integer | no | '2' |  |  |
| `reminder_channels` | reminderChannels | jsonb | no | '["email"]' |  |  |
| `payment_gateway` | paymentGateway | character varying(50) | yes |  |  |  |
| `tax_rate` | taxRate | numeric(5,2) | no | '0' |  |  |
| `late_fee_percentage` | lateFeePercentage | numeric(5,2) | no | '0' |  |  |
| `logo_url` | logoUrl | character varying(500) | yes |  |  |  |
| `primary_color` | primaryColor | character varying(20) | yes |  |  |  |
| `theme` | theme | character varying(20) | no | 'light' |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_84d2853faad00c6eebb7cd6e8c0` (location_id)
- UNIQUE `REL_84d2853faad00c6eebb7cd6e8c` (location_id)

Foreign keys (enforced):

- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (one-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="locations"></a>
#### `Location` → `locations`

- **File:** `src/locations/entities/location.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying(255) | no |  |  |  |
| `code` | code | character varying(50) | no |  |  |  |
| `token_prefix` | tokenPrefix | character varying(12) | yes |  |  | Short prefix for daily appointment tokens (e.g. "KHI" → "KHI-007"). Falls back to `code` when unset. |
| `address` | address | text | yes |  |  |  |
| `city` | city | character varying(100) | yes |  |  |  |
| `state` | state | character varying(100) | yes |  |  |  |
| `postal_code` | postalCode | character varying(20) | yes |  |  |  |
| `country` | country | character varying(100) | yes |  |  |  |
| `phone` | phone | character varying(20) | yes |  |  |  |
| `email` | email | character varying(255) | yes |  |  |  |
| `timezone` | timezone | character varying(100) | no | 'UTC' |  |  |
| `currency` | currency | character varying(10) | no | 'USD' |  |  |
| `manager_id` | managerId | uuid | yes |  | L |  |
| `operating_hours` | operatingHours | jsonb | yes |  |  |  |
| `capacity_per_day` | capacityPerDay | integer | yes |  |  |  |
| `total_chairs` | totalChairs | integer | no | '1' |  |  |
| `business_model` | businessModel | character varying(50) | yes |  |  |  |
| `is_main_branch` | isMainBranch | boolean | no | false |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `IDX_05e1afa2c4dd2e3784200b499b` (organization_id, code)
- INDEX `IDX_311e41074a7aa37e276e93c484` (organization_id, is_active)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `manager_id` → employees or users — not verified — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `access`

<a id="nav-layouts"></a>
#### `NavLayout` → `nav_layouts`

> A clinic's sidebar arrangement (design doc "Sidebar customization"): which nav keys go in which section, renames, hidden keys. It only arranges keys the web app's registry defines — it never grants access. `role_id` NULL = the clinic default (the only kind v1 writes). Postgres treats NULLs as disti…

- **File:** `src/access/nav/nav-layout.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `role_id` | roleId | uuid | yes |  | FK→`employment_roles` |  |
| `layout` | layout | jsonb | no |  |  |  |
| `version` | version | integer | no | '1' |  | +1 on every save. |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_nav_layouts_org_default` (organization_id) WHERE "role_id" IS NULL
- UNIQUE INDEX `uq_nav_layouts_org_role` (organization_id, role_id)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (role_id) → `employment_roles`(id) ON DELETE CASCADE — `role` (many-to-one)

Logical references (no FK):

- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `feature-flags`

<a id="feature-catalog"></a>
#### `FeatureCatalog` → `feature_catalog`

> Master catalog of every feature the platform offers. One row per feature; org-level toggles live in org_feature_flags.

- **File:** `src/feature-flags/entities/feature-catalog.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** global — platform catalog
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `key` | key | character varying(100) | no |  | UQ | Machine key, e.g. 'billing.invoices', 'comms.whatsapp' |
| `name` | name | character varying(255) | no |  |  | Human-readable label |
| `module` | module | character varying(100) | no |  |  | Grouping module, e.g. 'billing', 'appointments', 'patients' |
| `description` | description | text | yes |  |  |  |
| `specialty_tags` | specialtyTags | jsonb | no | '["general"]' |  | Clinic types this feature is relevant to: general, dental, skin, ortho, physio, eye |
| `enabled_by_default` | enabledByDefault | boolean | no | false |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `sort_order` | sortOrder | integer | no | '0' |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_8ba0240c947739bc923499c7af9` (key)
- INDEX `IDX_dd1eb2eebd03de578d4ce2946d` (is_active)
- INDEX `IDX_b144934f21ec58320656bf962e` (module)

<a id="location-feature-overrides"></a>
#### `LocationFeatureOverride` → `location_feature_overrides`

> Owner's per-location narrowing of an org feature: `is_disabled = true` turns an org-active feature OFF at one location. It can never turn a feature ON beyond the org setting (there is no "force on").

- **File:** `src/feature-flags/entities/location-feature-override.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L | Denormalized from the location, for tenant-scoped reads. |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `feature_key` | featureKey | character varying(100) | no |  |  | Denormalized from feature_catalog.key |
| `is_disabled` | isDisabled | boolean | no | false |  |  |
| `updated_by` | updatedBy | uuid | yes |  | L | userId of whoever last changed this override |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_923fd7aaa468d684bc8f0692407` (location_id, feature_key)
- INDEX `IDX_346c5da58e5b67c0d711c3f46b` (organization_id, location_id)

Foreign keys (enforced):

- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="org-feature-flags"></a>
#### `OrgFeatureFlag` → `org_feature_flags`

> Per-organization state of a catalog feature: - `is_entitled` — set by the super admin: the org may use the feature (until `entitled_until` when that is set — a trial expiry). - `is_enabled` — the clinic owner's switch. Active = active catalog entry ∧ entitled (not expired) ∧ enabled. featureKey is…

- **File:** `src/feature-flags/entities/org-feature-flag.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `feature_key` | featureKey | character varying(100) | no |  |  | Denormalized from feature_catalog.key |
| `is_enabled` | isEnabled | boolean | no | false |  |  |
| `enabled_by` | enabledBy | uuid | yes |  | L | userId of whoever last toggled this flag |
| `is_entitled` | isEntitled | boolean | no | true |  | Super admin's entitlement. Defaults to true so orgs that predate entitlement keep every feature they had. |
| `entitled_by` | entitledBy | uuid | yes |  | L | userId of the super admin who last changed the entitlement |
| `entitled_at` | entitledAt | timestamp with time zone | yes |  |  |  |
| `entitled_until` | entitledUntil | timestamp with time zone | yes |  |  | Trial expiry: from this moment on the feature is not entitled. |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_12479d498db953bbfcf6a7a74ed` (organization_id, feature_key)
- INDEX `IDX_d40bad2792dc6d584d8d107cd0` (organization_id, is_enabled)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `enabled_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `entitled_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `settings-registry`

<a id="config-values"></a>
#### `ConfigValue` → `config_values`

> One value of a registry setting (see `defineSetting`) at one scope. `value` null = nothing set here (the scope inherits), which lets a row carry only a lock: `is_locked` freezes the effective value at this scope so lower scopes can't override it. Postgres treats NULLs as distinct in unique indexes,…

- **File:** `src/settings-registry/entities/config-value.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** global — cascade platform → org → location via scope + scope_id
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `scope_type` | scopeType | enum(platform, org, location) | no |  |  |  |
| `scope_id` | scopeId | uuid | yes |  | L | Organization or location id; null for platform. |
| `key` | key | character varying(100) | no |  |  |  |
| `value` | value | jsonb | yes |  |  |  |
| `is_locked` | isLocked | boolean | no | false |  |  |
| `version` | version | integer | no | '1' |  | Bumped on every write. |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_config_values_platform_key` (key) WHERE "scope_type" = 'platform'
- UNIQUE INDEX `uq_config_values_scope_key` (scope_type, scope_id, key)

Logical references (no FK):

- `scope_id` → organizations or locations — discriminated by `scope` (comment) — VERIFIED polymorphic (type + id pair, no FK possible)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `subscriptions`

<a id="subscription-payments"></a>
#### `SubscriptionPayment` → `subscription_payments`

> A clinic's payment for its subscription, collected outside the app and recorded by a super admin. Each one extends `organizations.paid_until`.

- **File:** `src/subscriptions/entities/subscription-payment.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `plan` | plan | enum(free, starter, professional, enterprise) | no |  |  |  |
| `months` | months | integer | no |  |  |  |
| `amount` | amount | numeric(12,2) | no |  |  | PKR. |
| `method` | method | character varying(30) | no |  |  |  |
| `reference` | reference | character varying(120) | yes |  |  |  |
| `paid_at` | paidAt | timestamp with time zone | no |  |  |  |
| `period_start` | periodStart | timestamp with time zone | no |  |  |  |
| `period_end` | periodEnd | timestamp with time zone | no |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `recorded_by` | recordedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_9f1035687721dd9a0a709210cb` (organization_id, paid_at)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `recorded_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `employees`

<a id="doctor-availability-overrides"></a>
#### `DoctorAvailabilityOverride` → `doctor_availability_overrides`

- **File:** `src/employees/entities/doctor-availability-override.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `employee_id` | employeeId | uuid | no |  | FK→`employees` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `date` | date | date | no |  |  |  |
| `is_available` | isAvailable | boolean | no | false |  |  |
| `reason` | reason | text | yes |  |  |  |
| `override_hours` | overrideHours | jsonb | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_78584d465bb6b630df168632b92` (employee_id, location_id, date)
- INDEX `IDX_98bfbcb72a50974cc9185f09dd` (location_id, date)
- INDEX `IDX_c209be038e721da350950fdae5` (employee_id, date)

Foreign keys (enforced):

- (employee_id) → `employees`(id) ON DELETE CASCADE — `employee` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="employee-leaves"></a>
#### `EmployeeLeave` → `employee_leaves`

- **File:** `src/employees/entities/employee-leave.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `employee_id` | employeeId | uuid | no |  | FK→`employees` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `leave_type` | leaveType | enum(annual, sick, unpaid, maternity, paternity, other) | no | 'annual' |  |  |
| `start_date` | startDate | date | no |  |  |  |
| `end_date` | endDate | date | no |  |  |  |
| `total_days` | totalDays | integer | no | '1' |  |  |
| `status` | status | enum(pending, approved, rejected, cancelled) | no | 'pending' |  |  |
| `reason` | reason | text | yes |  |  |  |
| `review_note` | reviewNote | text | yes |  |  |  |
| `approved_by` | approvedBy | uuid | yes |  | L |  |
| `reviewed_at` | reviewedAt | timestamp with time zone | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_4f9bd58870a5f91286099d73e1` (start_date, end_date)
- INDEX `IDX_d0368f1ce5a4b1e31ea5d75585` (organization_id, location_id, status)
- INDEX `IDX_a14c39826eaa82a8e5e6525315` (employee_id, status)

Foreign keys (enforced):

- (employee_id) → `employees`(id) ON DELETE CASCADE — `employee` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

Logical references (no FK):

- `approved_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="employee-org-location-assignments"></a>
#### `EmployeeOrgLocationAssignment` → `employee_org_location_assignments`

- **File:** `src/employees/entities/employee-org-location-assignment.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `employee_id` | employeeId | uuid | no |  | FK→`employees` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `employment_role_id` | employmentRoleId | uuid | yes |  | FK→`employment_roles` |  |
| `designation` | designation | character varying(100) | no |  |  |  |
| `token_prefix` | tokenPrefix | character varying(6) | yes |  |  | Queue token prefix for this doctor at this location ("A" → "A-007"). Empty = first letter of the doctor's name. |
| `employment_type` | employmentType | enum(full_time, part_time, visiting, contract) | no | 'full_time' |  |  |
| `employee_code` | employeeCode | character varying(20) | no |  |  |  |
| `joining_date` | joiningDate | date | no |  |  |  |
| `gross_salary` | grossSalary | numeric(10,2) | yes |  |  | @deprecated Salary now lives in `compensation_plans` (versioned). Kept for old rows only and no longer written once a plan exists. |
| `has_portal_access` | hasPortalAccess | boolean | no | false |  | Portal access PER LOCATION |
| `user_id` | userId | uuid | yes |  | FK→`users` |  |
| `is_primary` | isPrimary | boolean | no | false |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_by` | createdBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_3c0b16f00b401de7378a239b50b` (organization_id, employee_code)
- UNIQUE `UQ_8039f4e698418cd832336a4bce6` (employee_id, location_id)
- INDEX `IDX_3954fdc19709bb4146cf7fc6a5` (employee_id, has_portal_access)
- INDEX `IDX_da684de5b0076528db1a27a1ce` (user_id)
- INDEX `IDX_e14ee1b11ef7703eaf909a38e8` (location_id, is_active)
- INDEX `IDX_ae0f91145877eebfd6ce518965` (employee_id, organization_id)

Foreign keys (enforced):

- (employee_id) → `employees`(id) ON DELETE CASCADE — `employee` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (employment_role_id) → `employment_roles`(id) ON DELETE SET NULL — `employmentRole` (many-to-one)
- (user_id) → `users`(uuid) ON DELETE SET NULL — `user` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="employee-schedules"></a>
#### `EmployeeSchedule` → `employee_schedules`

- **File:** `src/employees/entities/employee-schedule.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `employee_id` | employeeId | uuid | no |  | FK→`employees` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `day_of_week` | dayOfWeek | integer | no |  |  |  |
| `is_working` | isWorking | boolean | no | true |  |  |
| `start_time` | startTime | time without time zone | yes |  |  |  |
| `end_time` | endTime | time without time zone | yes |  |  |  |
| `slot_duration` | slotDuration | integer | no | '30' |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_by` | createdBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_2cae77accf4b741c197b6d0df39` (employee_id, location_id, day_of_week)
- INDEX `IDX_2b024ddf2bdfca7fb9cbc82874` (location_id, day_of_week)
- INDEX `IDX_43bfcab6a2badeafdd01833f15` (employee_id, location_id)

Foreign keys (enforced):

- (employee_id) → `employees`(id) ON DELETE CASCADE — `employee` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="employees"></a>
#### `Employee` → `employees`

- **File:** `src/employees/entities/employee.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** global — person record shared across orgs; scope lives on employee_org_location_assignments
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `full_name` | fullName | character varying(255) | no |  |  |  |
| `phone` | phone | character varying(20) | no |  | UQ |  |
| `cnic` | cnic | character varying(20) | yes |  | UQ |  |
| `gender` | gender | enum(male, female, other) | yes |  |  |  |
| `dob` | dob | date | yes |  |  |  |
| `profile_picture_url` | profilePictureUrl | character varying | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_cbc362d1c574464a63d3acc3ead` (phone)
- UNIQUE `UQ_79b407bc618fb44bd242308464a` (cnic)
- INDEX `IDX_79b407bc618fb44bd242308464` (cnic)
- INDEX `IDX_cbc362d1c574464a63d3acc3ea` (phone)

<a id="employment-roles"></a>
#### `EmploymentRole` → `employment_roles`

- **File:** `src/employees/entities/employment-role.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying(100) | no |  |  |  |
| `slug` | slug | character varying(100) | no |  |  |  |
| `permissions` | permissions | jsonb | no | '{}' |  | `{ [permission]: 'own' \| 'location' \| 'org' \| true }` — granted only; a missing key is no access (see src/access/catalog/permissions.ts). O… |
| `description` | description | text | yes |  |  |  |
| `template_key` | templateKey | character varying(50) | yes |  |  | System template this role was seeded from (`doctor`, `receptionist`…). |
| `home_route` | homeRoute | character varying(255) | yes |  |  | Where members land after login, e.g. `/queue/doctor`. |
| `is_system_role` | isSystemRole | boolean | no | true |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_3ed7e1308d885e1a412f55a57b9` (organization_id, slug)
- INDEX `IDX_61310cd2154f7f04ff30f90e12` (organization_id, is_active)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

### Module `payroll`

<a id="payroll-records"></a>
#### `PayrollRecord` → `payroll_records`

- **File:** `src/payroll/entities/payroll-record.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `employee_id` | employeeId | uuid | no |  | FK→`employees` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `month` | month | integer | no |  |  |  |
| `year` | year | integer | no |  |  |  |
| `period_label` | periodLabel | character varying(50) | no |  |  |  |
| `salary_amount` | salaryAmount | numeric(10,2) | no |  |  |  |
| `base_salary_minor` | baseSalaryMinor | bigint | no | '0' |  | Breakdown in integer paisa. total = base salary + commission; the rupee `salaryAmount` above mirrors total for older screens. |
| `commission_minor` | commissionMinor | bigint | no | '0' |  |  |
| `total_minor` | totalMinor | bigint | no | '0' |  |  |
| `status` | status | enum(pending, paid, on_hold) | no | 'pending' |  |  |
| `paid_at` | paidAt | timestamp with time zone | yes |  |  |  |
| `payment_method` | paymentMethod | enum(cash, bank_transfer, cheque) | yes |  |  |  |
| `payment_reference` | paymentReference | character varying | yes |  |  |  |
| `paid_by` | paidBy | uuid | yes |  | L |  |
| `notes` | notes | text | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_ab131112904aaaee42a05a8f42a` (employee_id, location_id, month, year)
- INDEX `IDX_99cd138fc33622db0bfb52ab34` (employee_id, year)
- INDEX `IDX_911fb49e96dd03d8c5685bad1b` (organization_id, location_id, month, year)

Foreign keys (enforced):

- (employee_id) → `employees`(id) ON DELETE CASCADE — `employee` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

Logical references (no FK):

- `paid_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `patients`

<a id="patient-communications"></a>
#### `PatientCommunication` → `patient_communications`

- **File:** `src/patients/entities/patient-communication.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `type` | type | enum(sms, whatsapp, call, email, in_person) | no |  |  |  |
| `direction` | direction | enum(inbound, outbound) | no |  |  |  |
| `purpose` | purpose | enum(appointment_reminder, appointment_confirmation, appointment_cancellation, recall_reminder, follow_up, billing, general, marketing, emergency) | no | 'general' |  |  |
| `subject` | subject | character varying(300) | yes |  |  |  |
| `message_body` | messageBody | text | yes |  |  |  |
| `status` | status | enum(pending, sent, delivered, read, failed, received) | no | 'pending' |  |  |
| `sent_at` | sentAt | timestamp with time zone | yes |  |  |  |
| `delivered_at` | deliveredAt | timestamp with time zone | yes |  |  |  |
| `read_at` | readAt | timestamp with time zone | yes |  |  |  |
| `sent_by` | sentBy | uuid | yes |  | L |  |
| `is_automated` | isAutomated | boolean | no | false |  |  |
| `automation_trigger` | automationTrigger | character varying(100) | yes |  |  |  |
| `external_message_id` | externalMessageId | character varying(200) | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_fa2a059ac50163cc6757a0fa31` (status)
- INDEX `IDX_4c836577148fb90d1b6aa6eec6` (sent_at)
- INDEX `IDX_c7408574b3a96cc4fc9229d0cf` (type)
- INDEX `IDX_5650769dce3ecffee0369e06ce` (organization_id)
- INDEX `IDX_b48ac12c2703758e2df9e24c72` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `appointment_id` → appointments — INFERRED (column name)
- `sent_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-consents"></a>
#### `PatientConsent` → `patient_consents`

> IMMUTABLE entity — no UPDATE or DELETE operations allowed. If consent is revoked, a new row with is_agreed = false is inserted.

- **File:** `src/patients/entities/patient-consent.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `consent_type` | consentType | enum(general_treatment, extraction, implant, root_canal, orthodontic, sedation, photo_release) | no |  |  |  |
| `consent_version` | consentVersion | character varying(20) | no | '1.0' |  |  |
| `consent_text` | consentText | text | no |  |  |  |
| `is_agreed` | isAgreed | boolean | no |  |  |  |
| `agreed_at` | agreedAt | timestamp with time zone | no | NOW() |  |  |
| `signed_by_name` | signedByName | character varying(150) | no |  |  |  |
| `signed_by_type` | signedByType | character varying(20) | no | 'patient' |  |  |
| `witnessed_by` | witnessedBy | uuid | yes |  | L |  |
| `signature_url` | signatureUrl | text | yes |  |  |  |
| `ip_address` | ipAddress | character varying(45) | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_3d7ecae44dcd9ce3a6669af9f7` (appointment_id)
- INDEX `IDX_455337f88ab731f6fd9c2e6f51` (consent_type)
- INDEX `IDX_4c963c4ceac1fb6768a7bd7e14` (organization_id)
- INDEX `IDX_7a6cd3c989f2517a7e9cbce576` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `appointment_id` → appointments — INFERRED (column name)
- `witnessed_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-dental-info"></a>
#### `PatientDentalInfo` → `patient_dental_info`

- **File:** `src/patients/entities/patient-dental-info.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` UQ |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `last_dental_checkup` | lastDentalCheckup | date | yes |  |  |  |
| `teeth_condition_notes` | teethConditionNotes | text | yes |  |  |  |
| `gum_condition` | gumCondition | enum(healthy, mild_gingivitis, moderate_gingivitis, severe_periodontitis) | no | 'healthy' |  |  |
| `teeth_sensitivity` | teethSensitivity | boolean | no | false |  |  |
| `sensitivity_notes` | sensitivityNotes | text | yes |  |  |  |
| `brushing_frequency` | brushingFrequency | enum(once_daily, twice_daily, irregular, unknown) | no | 'unknown' |  |  |
| `flossing_frequency` | flossingFrequency | enum(daily, occasionally, never, unknown) | no | 'unknown' |  |  |
| `smoking_status` | smokingStatus | boolean | no | false |  |  |
| `tobacco_chewing` | tobaccoChewing | boolean | no | false |  |  |
| `orthodontic_history` | orthodonticHistory | boolean | no | false |  |  |
| `orthodontic_notes` | orthodonticNotes | text | yes |  |  |  |
| `prosthetics_info` | prostheticsInfo | text | yes |  |  |  |
| `previous_extractions` | previousExtractions | text | yes |  |  |  |
| `previous_surgeries` | previousSurgeries | text | yes |  |  |  |
| `xray_notes` | xrayNotes | text | yes |  |  |  |
| `dentist_notes` | dentistNotes | text | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_4cf7efc3f9447906137c3f7d1c8` (patient_id)
- UNIQUE `REL_4cf7efc3f9447906137c3f7d1c` (patient_id)
- INDEX `IDX_07b93b9fdca1ceb3acba95b636` (organization_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (one-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="patient-documents"></a>
#### `PatientDocument` → `patient_documents`

- **File:** `src/patients/entities/patient-document.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `deleted_at` (@DeleteDateColumn)

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `document_type` | documentType | enum(xray, cbct_scan, report, prescription, consent_form, insurance_card, cnic_copy, photo_before, photo_after, other) | no |  |  |  |
| `file_name` | fileName | character varying(255) | no |  |  |  |
| `file_url` | fileUrl | text | no |  |  |  |
| `thumbnail_url` | thumbnailUrl | text | yes |  |  |  |
| `file_size_bytes` | fileSizeBytes | integer | yes |  |  |  |
| `mime_type` | mimeType | character varying(100) | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `tooth_number` | toothNumber | character varying(10) | yes |  |  |  |
| `taken_date` | takenDate | date | yes |  |  |  |
| `is_visible_to_patient` | isVisibleToPatient | boolean | no | false |  |  |
| `uploaded_by` | uploadedBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |
| `deleted_at` | deletedAt | timestamp without time zone | yes |  |  | @DeleteDateColumn |

Indexes and unique constraints:

- INDEX `IDX_55f5d266bf8e62f34a20b204ef` (appointment_id)
- INDEX `IDX_964b00f105cffecf9a5dfdac2b` (document_type)
- INDEX `IDX_46ebaddff5e88e2f61938916b1` (organization_id)
- INDEX `IDX_1a2f2efebe9442fc0c64c5d8db` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `appointment_id` → appointments — INFERRED (column name)
- `uploaded_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-feedback"></a>
#### `PatientFeedback` → `patient_feedback`

- **File:** `src/patients/entities/patient-feedback.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `dentist_id` | dentistId | uuid | yes |  | L |  |
| `rating` | rating | integer | no |  |  |  |
| `category` | category | enum(doctor, service, facility, billing, waiting_time, general) | no | 'general' |  |  |
| `feedback_text` | feedbackText | text | yes |  |  |  |
| `is_anonymous` | isAnonymous | boolean | no | false |  |  |
| `is_published` | isPublished | boolean | no | false |  |  |
| `response_text` | responseText | text | yes |  |  |  |
| `responded_by` | respondedBy | uuid | yes |  | L |  |
| `responded_at` | respondedAt | timestamp with time zone | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_07fd669b2a89c903f8b9eb70b0` (organization_id, is_published)
- INDEX `IDX_65dfe2d5caddefed8e2085c096` (rating)
- INDEX `IDX_044209403153483a6236a2a09f` (dentist_id)
- INDEX `IDX_7516a0c008eebb7215389b7d54` (organization_id)
- INDEX `IDX_a7dbd7061cc890c54c1802e99d` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `appointment_id` → appointments — INFERRED (column name)
- `dentist_id` → employees (or users — not verified) — INFERRED (column name)
- `responded_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-insurance"></a>
#### `PatientInsurance` → `patient_insurance`

- **File:** `src/patients/entities/patient-insurance.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `provider_name` | providerName | character varying(150) | no |  |  |  |
| `plan_name` | planName | character varying(150) | yes |  |  |  |
| `policy_number` | policyNumber | character varying(100) | no |  |  |  |
| `policy_holder_name` | policyHolderName | character varying(150) | yes |  |  |  |
| `group_number` | groupNumber | character varying(100) | yes |  |  |  |
| `coverage_details` | coverageDetails | text | yes |  |  |  |
| `coverage_percentage` | coveragePercentage | integer | no | '0' |  |  |
| `max_annual_benefit` | maxAnnualBenefit | numeric(12,2) | yes |  |  |  |
| `used_benefit` | usedBenefit | numeric(12,2) | no | '0' |  |  |
| `valid_from` | validFrom | date | yes |  |  |  |
| `valid_until` | validUntil | date | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `card_front_url` | cardFrontUrl | text | yes |  |  |  |
| `card_back_url` | cardBackUrl | text | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_de7987065c856b30a3ada7b700` (patient_id, is_active)
- INDEX `IDX_64d28c4898176f7aadd2e84078` (organization_id)
- INDEX `IDX_f1e090416faea8edd2a7219479` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="patient-prescriptions"></a>
#### `PatientPrescription` → `patient_prescriptions`

- **File:** `src/patients/entities/patient-prescription.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `prescribed_by` | prescribedBy | uuid | no |  | L |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `prescription_number` | prescriptionNumber | character varying(20) | no |  |  |  |
| `prescription_date` | prescriptionDate | date | no | ('now'::text)::date |  |  |
| `chief_complaint` | chiefComplaint | text | yes |  |  |  |
| `diagnosis` | diagnosis | text | yes |  |  |  |
| `medications` | medications | jsonb | no | '[]' |  | Array of medication objects with name, strength, dose, frequency, duration, etc. |
| `special_instructions` | specialInstructions | text | yes |  |  |  |
| `follow_up_date` | followUpDate | date | yes |  |  |  |
| `is_printed` | isPrinted | boolean | no | false |  |  |
| `printed_at` | printedAt | timestamp with time zone | yes |  |  |  |
| `print_count` | printCount | integer | no | '0' |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_aaafe096012249b92d18f43c65` (prescription_date)
- INDEX `IDX_778690fd07a456972fce090586` (prescribed_by)
- INDEX `IDX_3397d23d8ad82201539426bf58` (organization_id)
- INDEX `IDX_8145c2f97e7557243cc6f47ec1` (patient_id)
- UNIQUE INDEX `IDX_7dbcb34e3b399c74c470a8cd04` (organization_id, prescription_number)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `prescribed_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `appointment_id` → appointments — INFERRED (column name)

<a id="patient-recalls"></a>
#### `PatientRecall` → `patient_recalls`

- **File:** `src/patients/entities/patient-recall.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `dentist_id` | dentistId | uuid | yes |  | L |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `recall_type` | recallType | enum(6_month_checkup, annual_cleaning, post_treatment_followup, implant_review, orthodontic_review, custom) | no |  |  |  |
| `custom_name` | customName | character varying(200) | yes |  |  |  |
| `due_date` | dueDate | date | no |  |  |  |
| `first_reminder_sent_at` | firstReminderSentAt | timestamp with time zone | yes |  |  |  |
| `second_reminder_sent_at` | secondReminderSentAt | timestamp with time zone | yes |  |  |  |
| `third_reminder_sent_at` | thirdReminderSentAt | timestamp with time zone | yes |  |  |  |
| `status` | status | enum(scheduled, reminder_sent, contacted, booked, completed, ignored, overdue) | no | 'scheduled' |  |  |
| `notes` | notes | text | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_51a0cd0c2452012309705c71f8` (status)
- INDEX `IDX_d7c40446647323efa63d7155dc` (due_date)
- INDEX `IDX_c7eed509ae176ba825a229224b` (organization_id)
- INDEX `IDX_6917a1e7743353bc356d7b6c62` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `dentist_id` → employees (or users — not verified) — INFERRED (column name)
- `appointment_id` → appointments — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-referrals"></a>
#### `PatientReferral` → `patient_referrals`

- **File:** `src/patients/entities/patient-referral.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `referring_patient_id` | referringPatientId | uuid | no |  | FK→`patients` |  |
| `referred_patient_id` | referredPatientId | uuid | yes |  | FK→`patients` |  |
| `referred_name` | referredName | character varying(150) | yes |  |  |  |
| `referred_phone` | referredPhone | character varying(20) | yes |  |  |  |
| `referral_date` | referralDate | date | no | ('now'::text)::date |  |  |
| `reward_given` | rewardGiven | boolean | no | false |  |  |
| `reward_amount` | rewardAmount | numeric(8,2) | yes |  |  |  |
| `reward_type` | rewardType | character varying(50) | yes |  |  |  |
| `reward_given_at` | rewardGivenAt | timestamp with time zone | yes |  |  |  |
| `status` | status | enum(pending, registered, rewarded, cancelled) | no | 'pending' |  |  |
| `notes` | notes | text | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_3b95510af62151b6f832c7b982` (status)
- INDEX `IDX_f55bbd5346b2f6e082f512cd59` (referred_patient_id)
- INDEX `IDX_d9ffef096453b2f015fe9ddffc` (referring_patient_id)
- INDEX `IDX_1bed2dceb14d12de9a6f9d743a` (organization_id)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (referring_patient_id) → `patients`(id) ON DELETE CASCADE — `referringPatient` (many-to-one)
- (referred_patient_id) → `patients`(id) ON DELETE SET NULL — `referredPatient` (many-to-one)

<a id="patient-teeth-chart"></a>
#### `PatientTeethChart` → `patient_teeth_chart`

- **File:** `src/patients/entities/patient-teeth-chart.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `dentist_id` | dentistId | uuid | no |  | L |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `chart_data` | chartData | jsonb | no | '{}' |  | FDI notation chart data: { "11": { condition, treatment, surface, notes }, ... } |
| `periodontal_chart` | periodontalChart | jsonb | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `is_initial_chart` | isInitialChart | boolean | no | false |  |  |
| `recorded_at` | recordedAt | timestamp with time zone | no | NOW() |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_d585fba88e127802c113eb7e67` (recorded_at)
- INDEX `IDX_82cfcdcd27a199b9b78cb39ba8` (organization_id)
- INDEX `IDX_8953165c3a14acddc14c2c9f41` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `dentist_id` → employees (or users — not verified) — INFERRED (column name)
- `appointment_id` → appointments — INFERRED (column name)

<a id="patient-treatment-plans"></a>
#### `PatientTreatmentPlan` → `patient_treatment_plans`

- **File:** `src/patients/entities/patient-treatment-plan.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `deleted_at` (@DeleteDateColumn)

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `dentist_id` | dentistId | uuid | no |  | L |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `plan_number` | planNumber | character varying(20) | no |  |  |  |
| `plan_name` | planName | character varying(200) | no |  |  |  |
| `description` | description | text | yes |  |  |  |
| `estimated_cost` | estimatedCost | numeric(12,2) | yes |  |  |  |
| `discount_amount` | discountAmount | numeric(12,2) | no | '0' |  |  |
| `final_estimated_cost` | finalEstimatedCost | numeric(12,2) | yes |  |  |  |
| `status` | status | enum(draft, active, completed, cancelled, on_hold) | no | 'draft' |  |  |
| `start_date` | startDate | date | yes |  |  |  |
| `expected_end_date` | expectedEndDate | date | yes |  |  |  |
| `actual_end_date` | actualEndDate | date | yes |  |  |  |
| `patient_accepted` | patientAccepted | boolean | no | false |  |  |
| `patient_accepted_at` | patientAcceptedAt | timestamp with time zone | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |
| `deleted_at` | deletedAt | timestamp without time zone | yes |  |  | @DeleteDateColumn |

Indexes and unique constraints:

- INDEX `IDX_3dbaa7b558a0b408567d10da40` (dentist_id)
- INDEX `IDX_c4bfcb2591249ce25d71f11ec1` (status)
- INDEX `IDX_cb1cece74be32ef7abc3d748b7` (organization_id)
- INDEX `IDX_71eec248b4a16dd797c3264750` (patient_id)
- UNIQUE INDEX `IDX_ac380ece7861f7d5780ecd8857` (organization_id, plan_number)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `dentist_id` → employees (or users — not verified) — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-visits"></a>
#### `PatientVisit` → `patient_visits`

- **File:** `src/patients/entities/patient-visit.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `first_visit_date` | firstVisitDate | date | yes |  |  |  |
| `last_visit_date` | lastVisitDate | date | yes |  |  |  |
| `visit_count` | visitCount | integer | no | '0' |  |  |
| `total_spent` | totalSpent | numeric(12,2) | no | '0' |  |  |
| `is_preferred_location` | isPreferredLocation | boolean | no | false |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_6a450715fd0f4159a9bfaa29c63` (patient_id, location_id)
- INDEX `IDX_56371444b97f0d8694638d371b` (last_visit_date)
- INDEX `IDX_0c799db71642ed82a92a64d9a3` (organization_id)
- INDEX `IDX_1b1d71c9d1d47ee745fe6b6aba` (location_id)
- INDEX `IDX_906db448e7af552e4b036ca8a5` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="patient-vitals"></a>
#### `PatientVitals` → `patient_vitals`

- **File:** `src/patients/entities/patient-vitals.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `recorded_by` | recordedBy | uuid | no |  | L |  |
| `bp_systolic` | bpSystolic | integer | yes |  |  |  |
| `bp_diastolic` | bpDiastolic | integer | yes |  |  |  |
| `pulse_rate` | pulseRate | integer | yes |  |  |  |
| `temperature` | temperature | numeric(4,1) | yes |  |  |  |
| `oxygen_saturation` | oxygenSaturation | integer | yes |  |  |  |
| `weight_kg` | weightKg | numeric(5,2) | yes |  |  |  |
| `height_cm` | heightCm | numeric(5,2) | yes |  |  |  |
| `bmi` | bmi | numeric(4,2) | yes |  |  |  |
| `is_diabetic` | isDiabetic | boolean | no | false |  |  |
| `is_hypertensive` | isHypertensive | boolean | no | false |  |  |
| `is_pregnant` | isPregnant | boolean | no | false |  |  |
| `is_on_blood_thinners` | isOnBloodThinners | boolean | no | false |  |  |
| `is_on_antibiotics` | isOnAntibiotics | boolean | no | false |  |  |
| `anesthesia_type` | anesthesiaType | character varying(100) | yes |  |  |  |
| `anesthesia_dose` | anesthesiaDose | character varying(100) | yes |  |  |  |
| `anesthesia_administered_by` | anesthesiaAdministeredBy | uuid | yes |  | L |  |
| `notes` | notes | text | yes |  |  |  |
| `recorded_at` | recordedAt | timestamp with time zone | no | NOW() |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_53932386be037555eaf001bcba` (recorded_at)
- INDEX `IDX_1950b53b97d08da921a7597463` (appointment_id)
- INDEX `IDX_b8089b571c266a80263d9704b2` (organization_id)
- INDEX `IDX_5877a715e3a4b99d9ec3cccd97` (patient_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `appointment_id` → appointments — INFERRED (column name)
- `recorded_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `anesthesia_administered_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patients"></a>
#### `Patient` → `patients`

- **File:** `src/patients/entities/patient.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `deleted_at` (@DeleteDateColumn), `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `patient_number` | patientNumber | character varying(20) | no |  |  |  |
| `full_name` | fullName | character varying(150) | no |  |  |  |
| `dob` | dob | date | yes |  |  |  |
| `gender` | gender | enum(male, female, other) | yes |  |  |  |
| `blood_group` | bloodGroup | enum(A+, A-, B+, B-, AB+, AB-, O+, O-) | yes |  |  |  |
| `marital_status` | maritalStatus | enum(single, married, divorced, widowed) | yes |  |  |  |
| `occupation` | occupation | character varying(100) | yes |  |  |  |
| `cnic` | cnic | character varying(15) | yes |  |  |  |
| `phone` | phone | character varying(20) | no |  |  |  |
| `whatsapp_number` | whatsappNumber | character varying(20) | yes |  |  |  |
| `email` | email | character varying(150) | yes |  |  |  |
| `address` | address | text | yes |  |  |  |
| `city` | city | character varying(100) | yes |  |  |  |
| `preferred_language` | preferredLanguage | enum(urdu, english) | no | 'urdu' |  |  |
| `communication_pref` | communicationPref | enum(whatsapp, sms, call, email) | no | 'whatsapp' |  |  |
| `primary_location_id` | primaryLocationId | uuid | yes |  | FK→`locations` |  |
| `source` | source | enum(walk_in, referral, online, social_media, google, other) | no | 'walk_in' |  |  |
| `referred_by_text` | referredByText | character varying(200) | yes |  |  |  |
| `profile_picture_url` | profilePictureUrl | text | yes |  |  |  |
| `is_minor` | isMinor | boolean | no | false |  |  |
| `guardian_name` | guardianName | character varying(150) | yes |  |  |  |
| `guardian_phone` | guardianPhone | character varying(20) | yes |  |  |  |
| `guardian_relation` | guardianRelation | character varying(50) | yes |  |  |  |
| `medical_history` | medicalHistory | text | yes |  |  |  |
| `allergies` | allergies | text | yes |  |  |  |
| `emergency_contact_name` | emergencyContactName | character varying(150) | yes |  |  |  |
| `emergency_contact_phone` | emergencyContactPhone | character varying(20) | yes |  |  |  |
| `emergency_contact_relation` | emergencyContactRelation | character varying(50) | yes |  |  |  |
| `internal_notes` | internalNotes | text | yes |  |  |  |
| `tags` | tags | jsonb | no | '[]' |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `is_blacklisted` | isBlacklisted | boolean | no | false |  |  |
| `blacklist_reason` | blacklistReason | text | yes |  |  |  |
| `user_id` | userId | uuid | yes |  | L |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |
| `deleted_at` | deletedAt | timestamp without time zone | yes |  |  | @DeleteDateColumn |

Indexes and unique constraints:

- INDEX `IDX_fbc99f09a12744de1d3f9c9eee` (organization_id, is_blacklisted)
- INDEX `IDX_64eb8d6dbe1b45a3489d0b0606` (primary_location_id)
- INDEX `IDX_e85d7621a5f92d115a77fa2b5e` (cnic)
- INDEX `IDX_1e23017f3b56fa3ee6611392c4` (full_name)
- INDEX `IDX_8e8e6b29f954d02d0cf410dbaf` (phone)
- INDEX `IDX_9facec8f04ca77541396ec582e` (organization_id, is_active)
- UNIQUE INDEX `IDX_d3415d2be1291954d27101b16a` (organization_id, patient_number)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (primary_location_id) → `locations`(id) ON DELETE SET NULL — `primaryLocation` (many-to-one)

Logical references (no FK):

- `user_id` → users — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="treatment-plan-items"></a>
#### `TreatmentPlanItem` → `treatment_plan_items`

- **File:** `src/patients/entities/treatment-plan-item.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `plan_id` | planId | uuid | no |  | FK→`patient_treatment_plans` |  |
| `procedure_name` | procedureName | character varying(200) | no |  |  |  |
| `procedure_code` | procedureCode | character varying(20) | yes |  |  |  |
| `tooth_number` | toothNumber | character varying(10) | yes |  |  |  |
| `tooth_surface` | toothSurface | character varying(50) | yes |  |  |  |
| `estimated_sessions` | estimatedSessions | integer | no | '1' |  |  |
| `completed_sessions` | completedSessions | integer | no | '0' |  |  |
| `estimated_cost` | estimatedCost | numeric(10,2) | yes |  |  |  |
| `status` | status | enum(pending, in_progress, completed, skipped, postponed) | no | 'pending' |  |  |
| `sequence_order` | sequenceOrder | integer | no | '1' |  |  |
| `assigned_to` | assignedTo | uuid | yes |  | L |  |
| `clinical_notes` | clinicalNotes | text | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_1a0a7836b278152112a1054f57` (plan_id, sequence_order)
- INDEX `IDX_fa282996b444d6bd55851e16ef` (status)
- INDEX `IDX_979a9fab1b8c097eef8df1b4fb` (plan_id)

Foreign keys (enforced):

- (plan_id) → `patient_treatment_plans`(id) ON DELETE CASCADE — `plan` (many-to-one)

Logical references (no FK):

- `assigned_to` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `appointments`

<a id="appointments"></a>
#### `Appointment` → `appointments`

- **File:** `src/appointments/entities/appointment.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `doctor_id` | doctorId | uuid | no |  | FK→`employees` |  |
| `type` | type | enum(consultation, follow_up, treatment, checkup, emergency, cleaning) | no | 'consultation' |  |  |
| `status` | status | enum(scheduled, confirmed, checked_in, completed, cancelled, no_show) | no | 'scheduled' |  |  |
| `start_time` | startTime | timestamp with time zone | no |  |  |  |
| `end_time` | endTime | timestamp with time zone | no |  |  |  |
| `duration_minutes` | durationMinutes | integer | no | '30' |  |  |
| `reason_for_visit` | reasonForVisit | text | yes |  |  | Free-text reason the patient is visiting (shown in the queue row). |
| `is_emergency` | isEmergency | boolean | no | false |  |  |
| `notes` | notes | text | yes |  |  |  |
| `cancel_reason_code` | cancelReasonCode | enum(no_show, patient_left, other) | yes |  |  | Structured cancellation reason for analytics. |
| `cancel_reason` | cancelReason | text | yes |  |  | Optional free-text detail accompanying the cancellation. |
| `checked_in_at` | checkedInAt | timestamp with time zone | yes |  |  |  |
| `completed_at` | completedAt | timestamp with time zone | yes |  |  |  |
| `cancelled_at` | cancelledAt | timestamp with time zone | yes |  |  |  |
| `no_show_at` | noShowAt | timestamp with time zone | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_49654fef3553ed5510b1a5824d` (doctor_id, start_time, end_time)
- INDEX `IDX_3007a47d97a542e63b3308a69b` (status)
- INDEX `IDX_4cf26c3f972d014df5c68d503d` (doctor_id)
- INDEX `IDX_3330f054416745deaa2cc13070` (patient_id)
- INDEX `IDX_6766cb4aab4ff80c6c95e2d2fa` (organization_id)
- INDEX `IDX_29a60750f63d56836fd159974f` (location_id, start_time)

Constraints:

- EXCLUDE `no_doctor_overlap`: `USING gist ("doctor_id" WITH =, tstzrange("start_time", "end_time", '[)') WITH &&) WHERE ("status" NOT IN ('cancelled', 'no_show'))`

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (doctor_id) → `employees`(id) ON DELETE RESTRICT — `doctor` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `queue`

<a id="idempotency-keys"></a>
#### `IdempotencyKey` → `idempotency_keys`

> Stored result of a queue mutation, keyed by the client's Idempotency-Key. A retry with the same key returns the saved response instead of doing the work twice (e.g. a check-in whose reply was lost returns the same token).

- **File:** `src/queue/entities/idempotency-key.entity.ts`
- **PK:** `organization_id` + `key` (uuid, no default — app supplies; text, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `organization_id` | organizationId | uuid | no |  | PK |  |
| `key` | key | text | no |  | PK |  |
| `request_hash` | requestHash | text | no |  |  |  |
| `response_status` | responseStatus | integer | yes |  |  |  |
| `response_body` | responseBody | jsonb | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  |  |

<a id="outbox"></a>
#### `OutboxMessage` → `outbox`

> Transactional outbox: realtime messages are written in the same transaction as the queue change, then published by the relay. Screens therefore never see a change that rolled back, and never miss one that committed.

- **File:** `src/queue/entities/outbox-message.entity.ts`
- **PK:** `id` (bigint, generated: identity)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | bigint | no | generated (identity) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `topic` | topic | text | no |  |  | Socket room, e.g. `session:<id>` or `location:<id>:display`. |
| `payload` | payload | jsonb | no |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  |  |
| `published_at` | publishedAt | timestamp with time zone | yes |  |  |  |

Indexes and unique constraints:

- INDEX `outbox_unpublished` (id) WHERE "published_at" IS NULL

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

<a id="queue-entries"></a>
#### `QueueEntry` → `queue_entries`

> A patient's place in one doctor's queue for one day. Created only at check-in (booked appointment) or walk-in registration — never at booking. Database-level invariants (partial unique indexes): - one active entry per appointment - one active entry per patient per session - at most one entry with t…

- **File:** `src/queue/entities/queue-entry.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `queue_session_id` | queueSessionId | uuid | no |  | FK→`queue_sessions` |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `appointment_id` | appointmentId | uuid | yes |  | FK→`appointments` |  |
| `converted_from_appt_id` | convertedFromApptId | uuid | yes |  | L | Walk-in created from a too-late appointment ("Convert to walk-in"). |
| `transferred_from_id` | transferredFromId | uuid | yes |  | L | The entry this one replaced when transferred from another doctor. |
| `token_number` | tokenNumber | integer | no |  |  |  |
| `queue_type` | queueType | enum(appointment, walk_in) | no |  |  |  |
| `status` | status | enum(waiting, called, in_consultation, on_hold, skipped, completed, cancelled, transferred, aborted) | no | 'waiting' |  |  |
| `priority_class` | priorityClass | enum(normal, authorized_urgent) | no | 'normal' |  |  |
| `urgent_since` | urgentSince | timestamp with time zone | yes |  |  |  |
| `urgent_reason` | urgentReason | text | yes |  |  |  |
| `reason_for_visit` | reasonForVisit | text | yes |  |  |  |
| `checked_in_at` | checkedInAt | timestamp with time zone | no |  |  |  |
| `sort_anchor_at` | sortAnchorAt | timestamp with time zone | no |  |  | FIFO position: checked_in_at, or rejoined_at after an END-policy rejoin. |
| `called_at` | calledAt | timestamp with time zone | yes |  |  |  |
| `consultation_started_at` | consultationStartedAt | timestamp with time zone | yes |  |  |  |
| `hold_started_at` | holdStartedAt | timestamp with time zone | yes |  |  |  |
| `returned_from_hold_at` | returnedFromHoldAt | timestamp with time zone | yes |  |  |  |
| `skipped_at` | skippedAt | timestamp with time zone | yes |  |  |  |
| `finished_at` | finishedAt | timestamp with time zone | yes |  |  |  |
| `version` | version | integer | no | '0' |  |  |

Indexes and unique constraints:

- UNIQUE `uq_queue_entry_session_token` (queue_session_id, token_number)
- INDEX `IDX_ba6b99a46016f34c447016cdb0` (organization_id, patient_id)
- INDEX `entries_waiting` (queue_session_id, sort_anchor_at) WHERE "status" = 'waiting'
- UNIQUE INDEX `one_patient_with_doctor` (queue_session_id) WHERE "status" IN ('called','in_consultation')
- UNIQUE INDEX `one_active_entry_per_patient` (queue_session_id, patient_id) WHERE "status" IN ('waiting','called','in_consultation','on_hold','skipped')
- UNIQUE INDEX `one_active_entry_per_appt` (appointment_id) WHERE "status" IN ('waiting','called','in_consultation','on_hold','skipped')

Constraints:

- CHECK `CHK_def675f7f7d11ba7ceba6c83b5`: `"priority_class" = 'normal' OR ("urgent_since" IS NOT NULL AND "urgent_reason" IS NOT NULL)`
- CHECK `CHK_d642ae51493e1151a9acfd6fe0`: `("queue_type" = 'appointment') = ("appointment_id" IS NOT NULL)`
- CHECK `CHK_2c188fe8514fd7bc0fe0db3a05`: `"token_number" > 0`

Foreign keys (enforced):

- (queue_session_id) → `queue_sessions`(id) ON DELETE RESTRICT — `session` (many-to-one)
- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (appointment_id) → `appointments`(id) ON DELETE CASCADE — `appointment` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `converted_from_appt_id` → appointments — INFERRED (entity comment states target)
- `transferred_from_id` → queue_entries (self) — INFERRED (entity comment states target)

<a id="queue-events"></a>
#### `QueueEvent` → `queue_events`

> Append-only audit log of every queue change, written in the same transaction as the change. Corrections are new events, never updates. `seq` comes from the session's `event_seq`, so clients can apply events in order and detect gaps.

- **File:** `src/queue/entities/queue-event.entity.ts`
- **PK:** `id` (bigint, generated: identity)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | bigint | no | generated (identity) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `queue_session_id` | queueSessionId | uuid | no |  | L |  |
| `queue_entry_id` | queueEntryId | uuid | yes |  | L |  |
| `seq` | seq | bigint | no |  |  |  |
| `event_type` | eventType | text | no |  |  | CHECKED_IN, CALLED, SKIPPED, MODE_CHANGED, … |
| `from_status` | fromStatus | enum(waiting, called, in_consultation, on_hold, skipped, completed, cancelled, transferred, aborted) | yes |  |  |  |
| `to_status` | toStatus | enum(waiting, called, in_consultation, on_hold, skipped, completed, cancelled, transferred, aborted) | yes |  |  |  |
| `reason_code` | reasonCode | text | yes |  |  |  |
| `reason_text` | reasonText | text | yes |  |  |  |
| `suggested_entry_id` | suggestedEntryId | uuid | yes |  | L | On Select Patient: the entry the engine would have called. |
| `actor_id` | actorId | uuid | no |  | L |  |
| `actor_role` | actorRole | text | no |  |  |  |
| `metadata` | metadata | jsonb | no | '{}'::jsonb |  |  |
| `occurred_at` | occurredAt | timestamp with time zone | no | now() |  |  |

Indexes and unique constraints:

- UNIQUE `uq_queue_event_session_seq` (queue_session_id, seq)
- INDEX `IDX_15bc2df355bd06475f4edd9075` (organization_id, occurred_at)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `queue_session_id` → queue_sessions — INFERRED (column name)
- `queue_entry_id` → queue_entries — INFERRED (column name)
- `suggested_entry_id` → queue_entries — INFERRED (entity comment states target)
- `actor_id` → users — INFERRED (column name)

<a id="queue-policies"></a>
#### `QueuePolicy` → `queue_policies`

> Queue settings. A row with `location_id = NULL` is the organization default; a row with a location overrides it for that location. The timezone is not stored here — it is the location's own `locations.timezone`.

- **File:** `src/queue/entities/queue-policy.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | yes |  | L | NULL = organization default. |
| `smart_queue_enabled` | smartQueueEnabled | boolean | no | false |  |  |
| `early_window_min` | earlyWindowMin | integer | no | '15' |  |  |
| `late_grace_min` | lateGraceMin | integer | no | '10' |  |  |
| `max_late_min` | maxLateMin | integer | no | '45' |  |  |
| `walkin_starvation_min` | walkinStarvationMin | integer | no | '45' |  |  |
| `skipped_rejoin_policy` | skippedRejoinPolicy | enum(end, original_position, manual) | no | 'end' |  |  |
| `call_timeout_sec` | callTimeoutSec | integer | yes |  |  | NULL = auto-skip after a call is off. |
| `manual_select_reason_required` | manualSelectReasonRequired | boolean | no | false |  |  |
| `service_day_cutoff` | serviceDayCutoff | time without time zone | no | '00:00' |  | Local time a service day starts, e.g. "04:00" for a night-shift clinic. |
| `version` | version | integer | no | '0' |  |  |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_queue_policy_location` (organization_id, location_id) WHERE "location_id" IS NOT NULL
- UNIQUE INDEX `uq_queue_policy_org_default` (organization_id) WHERE "location_id" IS NULL

Constraints:

- CHECK `CHK_4b1c3445c1a7cfaa25ebe775a0`: `"max_late_min" >= "late_grace_min"`
- CHECK `CHK_ab58b122f38b85689803d3e386`: `"call_timeout_sec" IS NULL OR "call_timeout_sec" >= 30`
- CHECK `CHK_a276615c3badc451171cdaa9a0`: `"walkin_starvation_min" > 0`
- CHECK `CHK_95c37e5f292f7d5fe9e88e83bf`: `"late_grace_min" >= 0`
- CHECK `CHK_c7fb08a8d4049f27ec8634b54e`: `"early_window_min" BETWEEN 0 AND 240`

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)

<a id="queue-sessions"></a>
#### `QueueSession` → `queue_sessions`

> One doctor's queue for one service day at one location. Its row is the lock every queue mutation takes first (`SELECT … FOR UPDATE`), and it holds the token counter, so tokens are gap-free and never duplicated.

- **File:** `src/queue/entities/queue-session.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `doctor_id` | doctorId | uuid | no |  | FK→`employees` |  |
| `service_date` | serviceDate | date | no |  |  | Location-local date of the service day ("YYYY-MM-DD"). |
| `status` | status | enum(waiting_for_doctor, open, paused, closed) | no | 'waiting_for_doctor' |  |  |
| `last_token_number` | lastTokenNumber | integer | no | '0' |  |  |
| `token_prefix` | tokenPrefix | character varying(6) | no |  |  | Doctor's token prefix, copied when the session is created ("A"). |
| `smart_queue_enabled` | smartQueueEnabled | boolean | no |  |  | Copied from the policy when the session is created; changes only via the mode endpoint. |
| `last_call_reason` | lastCallReason | text | yes |  |  |  |
| `pause_reason` | pauseReason | text | yes |  |  |  |
| `started_at` | startedAt | timestamp with time zone | yes |  |  |  |
| `closed_at` | closedAt | timestamp with time zone | yes |  |  |  |
| `event_seq` | eventSeq | bigint | no | '0' |  |  |
| `version` | version | integer | no | '0' |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `uq_queue_session_doctor_day` (organization_id, location_id, doctor_id, service_date)

Constraints:

- CHECK `CHK_e086212b6c92f4ca6bdcc0fa86`: `"last_token_number" >= 0`

Foreign keys (enforced):

- (doctor_id) → `employees`(id) ON DELETE RESTRICT — `doctor` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)

### Module `encounters`

<a id="patient-encounters"></a>
#### `PatientEncounter` → `patient_encounters`

> The clinical record of a consultation — created when the doctor starts the consultation on a queue entry (booked or walk-in). Exactly one encounter per queue entry (unique queue_entry_id); `appointment_id` is set for booked visits and NULL for walk-ins. NOTE: distinct from `PatientVisit` (table `pa…

- **File:** `src/encounters/entities/patient-encounter.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `queue_entry_id` | queueEntryId | uuid | no |  | FK→`queue_entries` UQ |  |
| `appointment_id` | appointmentId | uuid | yes |  | FK→`appointments` |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `encounter_date` | encounterDate | timestamp with time zone | no |  |  |  |
| `reason` | reason | text | yes |  |  | Why they actually came — may differ from the appointment's reason. |
| `chief_complaint` | chiefComplaint | text | yes |  |  |  |
| `examination` | examination | text | yes |  |  |  |
| `diagnosis` | diagnosis | text | yes |  |  |  |
| `advice` | advice | text | yes |  |  | Advice / instructions given to the patient. |
| `follow_up_date` | followUpDate | date | yes |  |  | 'YYYY-MM-DD' — when the doctor wants to see the patient again. |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_8d6d7234aab692408a589573263` (queue_entry_id)
- INDEX `IDX_6deffc35738d2edf6884ee9c79` (encounter_date)
- INDEX `IDX_c020fc0907a762940b8f632003` (patient_id)
- INDEX `IDX_3ca0ea9e09cf06ec0b3bb98836` (location_id)
- INDEX `IDX_392aad68bfb23e21b2701cb695` (organization_id)
- INDEX `IDX_435c2016b12ca70e0d8eb330af` (appointment_id)

Foreign keys (enforced):

- (queue_entry_id) → `queue_entries`(id) ON DELETE CASCADE — `queueEntry` (many-to-one)
- (appointment_id) → `appointments`(id) ON DELETE SET NULL — `appointment` (many-to-one)
- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `treatments`

<a id="treatments"></a>
#### `Treatment` → `treatments`

> A treatment that was actually performed/rendered. ALWAYS belongs to a patient (never orphaned); optionally linked to the encounter it was carried out in. This is distinct from PatientTreatmentPlan / TreatmentPlanItem, which model a *planned* course of procedures with consent and cost estimates.

- **File:** `src/treatments/entities/treatment.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `encounter_id` | encounterId | uuid | yes |  | FK→`patient_encounters` |  |
| `plan_template_id` | planTemplateId | uuid | yes |  | FK→`plan_templates` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `treatment_name` | treatmentName | character varying(200) | no |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `cost` | cost | numeric(12,2) | yes |  |  | Legacy fee; billing falls back to it only when no service is set. |
| `service_id` | serviceId | uuid | yes |  | L | Catalog service (kind PROCEDURE) — billing prices the charge from it. |
| `date` | date | timestamp with time zone | no |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_d24c57b28692b858cb933d9f80` (encounter_id)
- INDEX `IDX_f63d122fc02fd144f49024e45d` (patient_id)
- INDEX `IDX_663ec032ef145bb211d073362c` (location_id)
- INDEX `IDX_8bac7680b98626abd18cae92e0` (organization_id)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (encounter_id) → `patient_encounters`(id) ON DELETE SET NULL — `encounter` (many-to-one)
- (plan_template_id) → `plan_templates`(id) ON DELETE SET NULL — `planTemplate` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

Logical references (no FK):

- `service_id` → services — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `plan-templates`

<a id="plan-templates"></a>
#### `PlanTemplate` → `plan_templates`

> A predefined treatment plan the doctor can pick for a patient — e.g. Root Canal Treatment with its usual steps. Using it copies the procedures into the patient's own plan, where they can still be edited. NOT to be confused with `treatment_plan_templates` (prescriptions module), which despite its na…

- **File:** `src/plan-templates/entities/plan-template.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `name` | name | character varying(200) | no |  |  |  |
| `category` | category | enum(GENERAL, PREVENTIVE, RESTORATIVE, ENDODONTICS, PERIODONTICS, ORAL_SURGERY, PROSTHODONTICS, IMPLANTOLOGY, ORTHODONTICS, PEDIATRIC, COSMETIC, GERIATRIC, ORAL_MEDICINE, TMJ_AND_OROFACIAL_PAIN, FULL_MOUTH_REHABILITATION, EMERGENCY, OTHER) | no | 'GENERAL' |  |  |
| `description` | description | text | yes |  |  |  |
| `items` | items | jsonb | no | '[]' |  |  |
| `is_active` | isActive | boolean | no | true |  | Inactive templates are hidden from the picker but kept. |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_e75226961323104fa944b9512b` (organization_id)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `prescriptions`

<a id="doctor-signatures"></a>
#### `DoctorSignature` → `doctor_signatures`

> A doctor's saved digital signature, attached to every prescription they finalize unless they explicitly draw a new one in the moment. Constraint: one active signature per doctor — repeat saves upsert in place (uniqueness is enforced at the DB level via the [employeeId] unique index). `signatureImag…

- **File:** `src/prescriptions/entities/doctor-signature.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `employee_id` | employeeId | uuid | no |  | UQ L | Owner of the signature. Currently set to the authenticated user's UUID (`req.user.uuid`). When a User→Employee mapping is added, this becom… |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `signature_image_url` | signatureImageUrl | text | no |  |  |  |
| `signature_data` | signatureData | text | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `IDX_02055ed33c86d0f2ded1f395f1` (employee_id)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `employee_id` → users (stores users.uuid despite the name) — INFERRED (entity comment states target)

<a id="medicine-directory"></a>
#### `MedicineDirectory` → `medicine_directory`

> The clinic's master medicine catalog. Powers the autocomplete on the prescription builder — doctors type and pick a medicine, which auto-fills dosage/frequency/duration/Urdu defaults defined here. Items are soft-disabled via `isActive`, never hard-deleted, so old prescriptions still resolve.

- **File:** `src/prescriptions/entities/medicine-directory.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying(200) | no |  |  |  |
| `generic_name` | genericName | character varying(200) | yes |  |  |  |
| `name_urdu` | nameUrdu | character varying(200) | yes |  |  |  |
| `type` | type | enum(TABLET, CAPSULE, SYRUP, INJECTION, CREAM, DROPS, INHALER, SACHET, SUPPOSITORY, OINTMENT, GEL, PATCH, SPRAY, POWDER, OTHER) | no | 'TABLET' |  |  |
| `strength` | strength | character varying(100) | yes |  |  |  |
| `manufacturer` | manufacturer | character varying(150) | yes |  |  |  |
| `default_dosage` | defaultDosage | character varying(100) | yes |  |  |  |
| `default_frequency` | defaultFrequency | character varying(100) | yes |  |  |  |
| `default_duration` | defaultDuration | character varying(100) | yes |  |  |  |
| `default_meal_relation` | defaultMealRelation | enum(BEFORE_MEAL, AFTER_MEAL, WITH_MEAL, EMPTY_STOMACH, NONE) | no | 'NONE' |  |  |
| `instructions_urdu` | instructionsUrdu | text | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_09c91d96f4c1d91a5adb31d7d9` (organization_id, name)
- INDEX `IDX_b520a18e4bb9e74e0a280b962e` (organization_id, is_active)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="prescription-history"></a>
#### `PrescriptionHistory` → `prescription_history`

> Immutable audit trail — one row per change event. For CREATED rows `previousData` is null; for AMENDED rows it's a full JSON snapshot of the prescription (and its medicines) BEFORE the change, so you can render any past version without re-fetching anything else.

- **File:** `src/prescriptions/entities/prescription-history.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `prescription_id` | prescriptionId | uuid | no |  | FK→`prescriptions` |  |
| `version` | version | integer | no |  |  |  |
| `changed_by` | changedBy | uuid | yes |  | L |  |
| `change_type` | changeType | enum(CREATED, AMENDED, FINALIZED, PRINTED, SHARED) | no |  |  |  |
| `previous_data` | previousData | jsonb | yes |  |  | Full snapshot of the prescription + medicines before this change. |
| `change_notes` | changeNotes | text | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_e3cf9d87ce0fea71b23cd7e0cb` (prescription_id, created_at)

Foreign keys (enforced):

- (prescription_id) → `prescriptions`(id) ON DELETE CASCADE — `prescription` (many-to-one)

Logical references (no FK):

- `changed_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="prescription-medicines"></a>
#### `PrescriptionMedicine` → `prescription_medicines`

> A single medicine line on a prescription. `medicineName` and the rest are stored DENORMALIZED so a finalized prescription remains a faithful self-contained record even after the underlying directory entry is renamed or disabled. `medicineDirectoryId` preserves the link for reporting / re-ordering /…

- **File:** `src/prescriptions/entities/prescription-medicine.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `prescription_id` | prescriptionId | uuid | no |  | FK→`prescriptions` |  |
| `medicine_directory_id` | medicineDirectoryId | uuid | yes |  | FK→`medicine_directory` |  |
| `medicine_name` | medicineName | character varying(200) | no |  |  |  |
| `medicine_name_urdu` | medicineNameUrdu | character varying(200) | yes |  |  |  |
| `type` | type | character varying(30) | yes |  |  |  |
| `dosage` | dosage | character varying(50) | no |  |  |  |
| `frequency` | frequency | character varying(100) | no |  |  |  |
| `frequency_timing` | frequencyTiming | jsonb | no | '[]' |  | Time-of-day tags: ["morning"], ["morning","evening"], etc. |
| `meal_relation` | mealRelation | enum(BEFORE_MEAL, AFTER_MEAL, WITH_MEAL, EMPTY_STOMACH, NONE) | no | 'NONE' |  |  |
| `duration` | duration | character varying(50) | no |  |  |  |
| `special_instructions` | specialInstructions | text | yes |  |  |  |
| `special_instructions_urdu` | specialInstructionsUrdu | text | yes |  |  |  |
| `sort_order` | sortOrder | integer | no | '0' |  |  |

Indexes and unique constraints:

- INDEX `IDX_ec23f4d56cf520bda640dfb8bf` (prescription_id)

Foreign keys (enforced):

- (prescription_id) → `prescriptions`(id) ON DELETE CASCADE — `prescription` (many-to-one)
- (medicine_directory_id) → `medicine_directory`(id) ON DELETE SET NULL — `medicineDirectory` (many-to-one)

<a id="prescription-templates"></a>
#### `PrescriptionTemplate` → `prescription_templates`

> Visual + structural layout for the printed prescription PDF: page size, margins, header/footer content, fonts, colors, toggles. A location can have its own default template; otherwise the org-wide default (locationId=null) applies. Multiple templates per location are allowed for special cases (e.g.…

- **File:** `src/prescriptions/entities/prescription-template.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | yes |  | FK→`locations` | Null = org-wide template applicable to any location. |
| `name` | name | character varying(150) | no |  |  |  |
| `is_default` | isDefault | boolean | no | false |  |  |
| `page_size` | pageSize | enum(A4, A5, LETTER, CUSTOM) | no | 'A4' |  |  |
| `orientation` | orientation | enum(PORTRAIT, LANDSCAPE) | no | 'PORTRAIT' |  |  |
| `custom_width_mm` | customWidthMm | numeric(6,2) | yes |  |  | Only used when pageSize === CUSTOM. |
| `custom_height_mm` | customHeightMm | numeric(6,2) | yes |  |  |  |
| `header` | header | jsonb | no | '{}' |  | Header content: logo, clinic + doctor names (English + Urdu), qualifications, phones, registration number. See CreatePrescriptionTemplateDt… |
| `footer` | footer | jsonb | no | '{}' |  | Footer content: address, timings, disclaimer (English + Urdu). |
| `styling` | styling | jsonb | no | '{}' |  | Styling: colors, fonts, sizes, toggles (showVitals, showMedicineUrdu, signaturePosition, watermarkText, margins). |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_0c1e34c22495cee59b4e9b5a11` (location_id, is_default)
- INDEX `IDX_28b8e1ba1e5b49cb11a9d0dd7d` (organization_id, is_active)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="prescriptions"></a>
#### `Prescription` → `prescriptions`

> A concrete prescription issued to a patient — the medical record the doctor signs and shares. Coexists with the legacy `patient_prescriptions` table (different table name, different controller path) so existing rows keep working while consumers migrate to this richer schema. Lifecycle: DRAFT — bein…

- **File:** `src/prescriptions/entities/prescription.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `prescription_number` | prescriptionNumber | character varying(30) | no |  | UQ | Sequential per org — "RX-2026-00001". |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `appointment_id` | appointmentId | uuid | yes |  | FK→`appointments` |  |
| `encounter_id` | encounterId | uuid | yes |  | FK→`patient_encounters` |  |
| `doctor_id` | doctorId | uuid | yes |  | FK→`employees` |  |
| `prescription_template_id` | prescriptionTemplateId | uuid | yes |  | FK→`prescription_templates` |  |
| `treatment_plan_template_id` | treatmentPlanTemplateId | uuid | yes |  | FK→`treatment_plan_templates` |  |
| `diagnosis` | diagnosis | text | yes |  |  |  |
| `chief_complaint` | chiefComplaint | text | yes |  |  |  |
| `further_plan` | furtherPlan | text | yes |  |  |  |
| `instructions_english` | instructionsEnglish | text | yes |  |  |  |
| `instructions_urdu` | instructionsUrdu | text | yes |  |  |  |
| `vitals` | vitals | jsonb | yes |  |  | { bp, pulse, temperature, spo2, weight, height, bmi, respiratoryRate }. |
| `signature_image_url` | signatureImageUrl | text | yes |  |  |  |
| `signed_at` | signedAt | timestamp with time zone | yes |  |  |  |
| `status` | status | enum(DRAFT, FINALIZED, AMENDED) | no | 'DRAFT' |  |  |
| `pdf_url` | pdfUrl | text | yes |  |  | Cached generated PDF URL — cleared when the record is amended. |
| `version` | version | integer | no | '1' |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_d234a398a58d401c4cf7c5951d9` (prescription_number)
- INDEX `IDX_2d6a1941bd705056030c2b9e07` (doctor_id)
- INDEX `IDX_f09b4189e7145df4fe7565246c` (encounter_id)
- INDEX `IDX_94491da15bc982f3435690fc96` (appointment_id)
- INDEX `IDX_9389db557647131856661f7d7b` (patient_id)
- INDEX `IDX_6a49dcc4097ae0c3f32f6b4303` (organization_id, location_id)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (appointment_id) → `appointments`(id) ON DELETE SET NULL — `appointment` (many-to-one)
- (encounter_id) → `patient_encounters`(id) ON DELETE SET NULL — `encounter` (many-to-one)
- (doctor_id) → `employees`(id) ON DELETE SET NULL — `doctor` (many-to-one)
- (prescription_template_id) → `prescription_templates`(id) ON DELETE SET NULL — `prescriptionTemplate` (many-to-one)
- (treatment_plan_template_id) → `treatment_plan_templates`(id) ON DELETE SET NULL — `treatmentPlanTemplate` (many-to-one)

<a id="treatment-plan-template-medicines"></a>
#### `TreatmentPlanTemplateMedicine` → `treatment_plan_template_medicines`

> A medicine line inside a reusable treatment-plan template. `medicineDirectoryId` links back to the catalog row that seeded this line — but `medicineName` (and the rest) are stored DENORMALIZED so the template keeps working unchanged if the directory row is renamed or disabled later.

- **File:** `src/prescriptions/entities/treatment-plan-template-medicine.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `template_id` | templateId | uuid | no |  | FK→`treatment_plan_templates` |  |
| `medicine_directory_id` | medicineDirectoryId | uuid | yes |  | FK→`medicine_directory` |  |
| `medicine_name` | medicineName | character varying(200) | no |  |  |  |
| `medicine_name_urdu` | medicineNameUrdu | character varying(200) | yes |  |  |  |
| `type` | type | character varying(30) | yes |  |  |  |
| `dosage` | dosage | character varying(50) | no |  |  |  |
| `frequency` | frequency | character varying(100) | no |  |  |  |
| `frequency_timing` | frequencyTiming | jsonb | no | '[]' |  | Time-of-day tags for the dose: ["morning"], ["morning","evening"], etc. Allowed values: morning, afternoon, evening, night, sos. |
| `meal_relation` | mealRelation | enum(BEFORE_MEAL, AFTER_MEAL, WITH_MEAL, EMPTY_STOMACH, NONE) | no | 'NONE' |  |  |
| `duration` | duration | character varying(50) | no |  |  |  |
| `special_instructions` | specialInstructions | text | yes |  |  |  |
| `special_instructions_urdu` | specialInstructionsUrdu | text | yes |  |  |  |
| `sort_order` | sortOrder | integer | no | '0' |  |  |

Indexes and unique constraints:

- INDEX `IDX_867f81c580652c9cf9d51f2097` (template_id)

Foreign keys (enforced):

- (template_id) → `treatment_plan_templates`(id) ON DELETE CASCADE — `template` (many-to-one)
- (medicine_directory_id) → `medicine_directory`(id) ON DELETE SET NULL — `medicineDirectory` (many-to-one)

<a id="treatment-plan-templates"></a>
#### `TreatmentPlanTemplate` → `treatment_plan_templates`

> A predefined, reusable prescription protocol — e.g. "Root Canal Aftercare" or "Scaling Post-care". Selecting one in the prescription builder pre-fills the medicines, further-plan text, and bilingual instructions; the doctor can still edit anything before finalizing. Medicines are eager-loaded becau…

- **File:** `src/prescriptions/entities/treatment-plan-template.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying(200) | no |  |  |  |
| `description` | description | text | yes |  |  |  |
| `category` | category | enum(GENERAL, PAIN_RELIEF, TOOTHACHE, TOOTH_SENSITIVITY, SWELLING_AND_INFLAMMATION, FEVER, ALLERGY, INFECTION_ANTIBIOTIC, DENTAL_ABSCESS, ROOT_CANAL, POST_ROOT_CANAL, FILLING_AND_RESTORATIVE, EXTRACTION, POST_EXTRACTION, WISDOM_TOOTH, DRY_SOCKET, ORAL_SURGERY, POST_OPERATIVE, ANESTHESIA_AFTERCARE, IMPLANT, CROWN_AND_BRIDGE, DENTURE, ORTHODONTIC, SCALING_AND_CLEANING, TEETH_WHITENING_COSMETIC, GUM_DISEASE, MOUTH_ULCERS, ORAL_FUNGAL_INFECTION, BAD_BREATH, DRY_MOUTH, TMJ_DISORDER, DENTAL_TRAUMA, EMERGENCY, PEDIATRIC, PREGNANCY_SAFE, ELDERLY, DIABETIC_PATIENT, PREVENTIVE_CARE, VITAMINS_AND_SUPPLEMENTS, OTHER) | no | 'GENERAL' |  |  |
| `specialty_tags` | specialtyTags | jsonb | no | '["general"]' |  | Mirrors the org-level specialty system — defaults to ['general']. |
| `further_plan` | furtherPlan | text | yes |  |  |  |
| `instructions_english` | instructionsEnglish | text | yes |  |  |  |
| `instructions_urdu` | instructionsUrdu | text | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_9b6567886b1bdb56f7d45a37de` (organization_id, category)
- INDEX `IDX_206010b932da72701302f4000b` (organization_id, is_active)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `engine`

<a id="form-schema-versions"></a>
#### `FormSchemaVersion` → `form_schema_versions`

> One version of a form. Draft → published → retired. A published version is immutable (a trigger rejects edits to its content and deletes), and every order item pins the version it was filled in, so changing a form never breaks old orders (lab ERD §3). At most one draft and one published version per…

- **File:** `src/engine/entities/form-schema-version.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `form_schema_id` | formSchemaId | uuid | no |  | FK→`form_schemas` |  |
| `version_no` | versionNo | integer | no |  |  |  |
| `schema_json` | schemaJson | jsonb | no |  |  | `{ fields: FieldDef[] }`, normalised on save. |
| `ui_json` | uiJson | jsonb | yes |  |  | Layout (sections, tooth-chart widget settings). |
| `promotions` | promotions | jsonb | no | '{}'::jsonb |  | Field key → `table.column` the answer is copied into. |
| `status` | status | enum(draft, published, retired) | no | 'draft' |  |  |
| `published_at` | publishedAt | timestamp with time zone | yes |  |  |  |
| `published_by` | publishedBy | uuid | yes |  | L |  |
| `retired_at` | retiredAt | timestamp with time zone | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_form_schema_versions_no` (form_schema_id, version_no)
- UNIQUE INDEX `uq_form_schema_versions_one_published` (form_schema_id) WHERE "status" = 'published'
- UNIQUE INDEX `uq_form_schema_versions_one_draft` (form_schema_id) WHERE "status" = 'draft'

Constraints:

- CHECK `chk_form_schema_versions_published_at`: `("status" = 'draft') = ("published_at" IS NULL)`
- CHECK `chk_form_schema_versions_no`: `"version_no" > 0`

Foreign keys (enforced):

- (form_schema_id) → `form_schemas`(id) ON DELETE RESTRICT — `formSchema` (many-to-one)

Logical references (no FK):

- `published_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="form-schemas"></a>
#### `FormSchema` → `form_schemas`

> A form (CROWN, BRIDGE …) — the stable identity; its content lives in versions. `organization_id` null = platform default; an organization's own schema with the same code overrides the default for that organization.

- **File:** `src/engine/entities/form-schema.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `specialty_id` | specialtyId | uuid | no |  | FK→`specialties` |  |
| `organization_id` | organizationId | uuid | yes |  | FK→`organizations` |  |
| `code` | code | character varying(50) | no |  |  | Upper-case, stable: `CROWN`. Lab services point at forms by id. |
| `name` | name | character varying(150) | no |  |  |  |
| `description` | description | text | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  | Archived forms are not offered for new services; pinned orders keep working. |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_form_schemas_org_code` (organization_id, specialty_id, code) WHERE "organization_id" IS NOT NULL
- UNIQUE INDEX `uq_form_schemas_platform_code` (specialty_id, code) WHERE "organization_id" IS NULL

Foreign keys (enforced):

- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="organization-specialties"></a>
#### `OrganizationSpecialty` → `organization_specialties`

> Which specialties an organization works in. Rows are created lazily from `specialties.enabled_by_default` the first time an organization is read.

- **File:** `src/engine/entities/organization-specialty.entity.ts`
- **PK:** `organization_id` + `specialty_id` (uuid, no default — app supplies; uuid, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `organization_id` | organizationId | uuid | no |  | PK FK→`organizations` |  |
| `specialty_id` | specialtyId | uuid | no |  | PK FK→`specialties` |  |
| `is_enabled` | isEnabled | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `updated_by` | updatedBy | uuid | yes |  | L |  |

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)

Logical references (no FK):

- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="specialties"></a>
#### `Specialty` → `specialties`

> A clinical specialty the engine is configured for (DENTAL, PATHOLOGY …). Platform-level. Forms, workflows and stage templates hang off it, so a new specialty is data, not code (lab ERD §17).

- **File:** `src/engine/entities/specialty.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** global — platform catalog
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `code` | code | character varying(30) | no |  | UQ | Upper-case, stable: `DENTAL`. |
| `name` | name | character varying(100) | no |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `enabled_by_default` | enabledByDefault | boolean | no | false |  | New organizations get it switched on (DENTAL: yes). |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `UQ_0ecc16d70a3eba636ba693759da` (code)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="stage-template-steps"></a>
#### `StageTemplateStep` → `stage_template_steps`

- **File:** `src/engine/entities/stage-template.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `stage_template_id` | stageTemplateId | uuid | no |  | FK→`stage_templates` |  |
| `seq` | seq | integer | no |  |  | 1-based order. |
| `code` | code | character varying(50) | no |  |  |  |
| `name` | name | character varying(100) | no |  |  |  |
| `requires_patient_visit` | requiresPatientVisit | boolean | no | true |  |  |
| `requires_doctor_approval` | requiresDoctorApproval | boolean | no | true |  |  |
| `default_lab_days` | defaultLabDays | integer | no | '3' |  |  |

Indexes and unique constraints:

- UNIQUE `uq_stage_template_steps_code` (stage_template_id, code)
- UNIQUE `uq_stage_template_steps_seq` (stage_template_id, seq)

Constraints:

- CHECK `chk_stage_template_steps_seq`: `"seq" > 0`
- CHECK `chk_stage_template_steps_days`: `"default_lab_days" BETWEEN 0 AND 365`

Foreign keys (enforced):

- (stage_template_id) → `stage_templates`(id) ON DELETE CASCADE — `stageTemplate` (many-to-one)

<a id="stage-templates"></a>
#### `StageTemplate` → `stage_templates`

> The try-in rounds a piece of work goes through (PFM: metal → bisque → final). Orders copy the step names into their own stage rows, so editing a template never changes work already in progress.

- **File:** `src/engine/entities/stage-template.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `specialty_id` | specialtyId | uuid | no |  | FK→`specialties` |  |
| `organization_id` | organizationId | uuid | yes |  | FK→`organizations` |  |
| `code` | code | character varying(50) | no |  |  |  |
| `name` | name | character varying(150) | no |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_stage_templates_org_code` (organization_id, specialty_id, code) WHERE "organization_id" IS NOT NULL
- UNIQUE INDEX `uq_stage_templates_platform_code` (specialty_id, code) WHERE "organization_id" IS NULL

Foreign keys (enforced):

- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="transition-effects"></a>
#### `TransitionEffect` → `transition_effects`

> An effect a transition runs, in `seq` order, inside its transaction.

- **File:** `src/engine/entities/workflow-effect.entity.ts`
- **PK:** `transition_id` + `effect_code` (uuid, no default — app supplies; character varying, no default — app supplies)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `transition_id` | transitionId | uuid | no |  | PK FK→`workflow_transitions` |  |
| `effect_code` | effectCode | character varying(60) | no |  | PK FK→`workflow_effects` |  |
| `seq` | seq | integer | no |  |  |  |
| `params` | params | jsonb | yes |  |  |  |

Indexes and unique constraints:

- UNIQUE `uq_transition_effects_seq` (transition_id, seq)

Foreign keys (enforced):

- (transition_id) → `workflow_transitions`(id) ON DELETE RESTRICT — `transition` (many-to-one)
- (effect_code) → `workflow_effects`(code) ON DELETE RESTRICT — `effect` (many-to-one)

<a id="workflow-effects"></a>
#### `WorkflowEffect` → `workflow_effects`

> Registry of effect handlers that exist in code (lab ERD §3). Synced from the in-memory registry on boot; configuration can only pick from these, never run new code.

- **File:** `src/engine/entities/workflow-effect.entity.ts`
- **PK:** `code` (character varying, no default — app supplies)
- **Tenant scope:** global — platform catalog
- **Timestamps:** `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `code` | code | character varying(60) | no |  | PK |  |
| `description` | description | text | no |  |  |  |
| `is_financial` | isFinancial | boolean | no | false |  | Financial effects validate themselves in code; config cannot skip that. |
| `is_available` | isAvailable | boolean | no | true |  | False when the handler was removed from code (kept for old versions). |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

<a id="workflow-states"></a>
#### `WorkflowState` → `workflow_states`

> A state of a published workflow version (written once, at publish).

- **File:** `src/engine/entities/workflow-state.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `template_version_id` | templateVersionId | uuid | no |  | FK→`workflow_template_versions` |  |
| `code` | code | character varying(50) | no |  |  |  |
| `name` | name | character varying(100) | no |  |  |  |
| `category` | category | enum(initial, active, waiting, done, cancelled) | no |  |  |  |
| `is_terminal` | isTerminal | boolean | no |  |  |  |
| `sort_order` | sortOrder | integer | no |  |  |  |

Indexes and unique constraints:

- UNIQUE `uq_workflow_states_code` (template_version_id, code)

Foreign keys (enforced):

- (template_version_id) → `workflow_template_versions`(id) ON DELETE RESTRICT — `templateVersion` (many-to-one)

<a id="workflow-template-versions"></a>
#### `WorkflowTemplateVersion` → `workflow_template_versions`

> One version of a workflow. A draft's definition is edited as JSON (`definition_json`); publishing checks it and materialises it into `workflow_states`, `workflow_transitions` and `transition_effects`, which the runtime reads. Published versions never change (service-enforced).

- **File:** `src/engine/entities/workflow-template-version.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `workflow_template_id` | workflowTemplateId | uuid | no |  | FK→`workflow_templates` |  |
| `version_no` | versionNo | integer | no |  |  |  |
| `definition_json` | definitionJson | jsonb | no |  |  | Snapshot of the definition (the draft's working copy). |
| `status` | status | enum(draft, published, retired) | no | 'draft' |  |  |
| `published_at` | publishedAt | timestamp with time zone | yes |  |  |  |
| `published_by` | publishedBy | uuid | yes |  | L |  |
| `retired_at` | retiredAt | timestamp with time zone | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_workflow_template_versions_no` (workflow_template_id, version_no)
- UNIQUE INDEX `uq_workflow_template_versions_one_published` (workflow_template_id) WHERE "status" = 'published'
- UNIQUE INDEX `uq_workflow_template_versions_one_draft` (workflow_template_id) WHERE "status" = 'draft'

Constraints:

- CHECK `chk_workflow_template_versions_no`: `"version_no" > 0`

Foreign keys (enforced):

- (workflow_template_id) → `workflow_templates`(id) ON DELETE RESTRICT — `workflowTemplate` (many-to-one)

Logical references (no FK):

- `published_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="workflow-templates"></a>
#### `WorkflowTemplate` → `workflow_templates`

> A workflow (state machine) for orders, items or stages. Content lives in versions; every order/item/stage pins the version it started on. `organization_id` null = platform default.

- **File:** `src/engine/entities/workflow-template.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `specialty_id` | specialtyId | uuid | no |  | FK→`specialties` |  |
| `organization_id` | organizationId | uuid | yes |  | FK→`organizations` |  |
| `entity_type` | entityType | enum(order, item, stage) | no |  |  |  |
| `code` | code | character varying(50) | no |  |  |  |
| `name` | name | character varying(150) | no |  |  |  |
| `description` | description | text | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_workflow_templates_org_code` (organization_id, specialty_id, code) WHERE "organization_id" IS NOT NULL
- UNIQUE INDEX `uq_workflow_templates_platform_code` (specialty_id, code) WHERE "organization_id" IS NULL

Foreign keys (enforced):

- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="workflow-transitions"></a>
#### `WorkflowTransition` → `workflow_transitions`

> An allowed move of a published workflow version (written once, at publish).

- **File:** `src/engine/entities/workflow-transition.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `template_version_id` | templateVersionId | uuid | no |  | FK→`workflow_template_versions` |  |
| `from_state_id` | fromStateId | uuid | no |  | FK→`workflow_states` |  |
| `to_state_id` | toStateId | uuid | no |  | FK→`workflow_states` |  |
| `action_code` | actionCode | character varying(50) | no |  |  |  |
| `allowed_roles` | allowedRoles | text[] | no | '{}' |  | Empty = any role of an allowed side. |
| `allowed_sides` | allowedSides | text[] | no |  |  |  |
| `required_fields` | requiredFields | jsonb | no | '[]'::jsonb |  |  |
| `requires_reason` | requiresReason | boolean | no | false |  |  |

Indexes and unique constraints:

- UNIQUE `uq_workflow_transitions_move` (template_version_id, from_state_id, action_code, to_state_id)

Foreign keys (enforced):

- (template_version_id) → `workflow_template_versions`(id) ON DELETE RESTRICT — `templateVersion` (many-to-one)
- (from_state_id) → `workflow_states`(id) ON DELETE RESTRICT — `fromState` (many-to-one)
- (to_state_id) → `workflow_states`(id) ON DELETE RESTRICT — `toState` (many-to-one)

### Module `billing`

<a id="billing-audit-logs"></a>
#### `BillingAuditLog` → `billing_audit_logs`

> Append-only audit of every billing state change (6.15). The repo has no general audit module with before/after snapshots (V7), so billing keeps its own. Invoice EDITED rows hold full snapshots used for revisions.

- **File:** `src/billing/entities/billing-audit-log.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | yes |  | L | Null only for org-level entities (services, discount types). |
| `entity_type` | entityType | enum(CHARGE, INVOICE, PAYMENT, REFUND, DISCOUNT_TYPE, SERVICE, SERVICE_PRICE, SETTINGS, PAYMENT_ACCOUNT, CASH_CLOSE) | no |  |  |  |
| `entity_id` | entityId | uuid | no |  | L |  |
| `action` | action | enum(CREATED, UPDATED, DELETED, VOIDED, DISCOUNT_APPLIED, DISCOUNT_REMOVED, PRICE_CHANGED, ISSUED, EDITED, CANCELLED, ALLOCATED, UNAPPLIED, REFUNDED, CLOSED) | no |  |  |  |
| `before` | before | jsonb | yes |  |  |  |
| `after` | after | jsonb | yes |  |  |  |
| `amount` | amount | numeric(12,2) | yes |  |  | Money moved by the action, for activity totals. |
| `reason` | reason | character varying(300) | yes |  |  |  |
| `actor_id` | actorId | uuid | no |  | L |  |
| `actor_role` | actorRole | character varying(30) | no |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_billing_audit_entity` (entity_type, entity_id)
- INDEX `idx_billing_audit_org_loc_created` (organization_id, location_id, created_at)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `entity_id` → polymorphic — discriminated by `entity_type` — VERIFIED polymorphic (type + id pair, no FK possible)
- `actor_id` → users — INFERRED (column name)

<a id="cash-close-lines"></a>
#### `CashCloseLine` → `cash_close_lines`

- **File:** `src/billing/entities/cash-close.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `cash_close_id` | cashCloseId | uuid | no |  | FK→`cash_closes` |  |
| `payment_account_id` | paymentAccountId | uuid | no |  | L |  |
| `payment_account_name` | paymentAccountName | character varying(60) | no |  |  |  |
| `payments_total` | paymentsTotal | numeric(12,2) | no | '0' |  |  |
| `refunds_total` | refundsTotal | numeric(12,2) | no | '0' |  |  |
| `payment_count` | paymentCount | integer | no | '0' |  |  |
| `refund_count` | refundCount | integer | no | '0' |  |  |
| `expected` | expected | numeric(12,2) | no |  |  |  |
| `counted` | counted | numeric(12,2) | yes |  |  |  |
| `variance` | variance | numeric(12,2) | no |  |  |  |

Indexes and unique constraints:

- INDEX `idx_cash_close_lines_close` (cash_close_id)

Foreign keys (enforced):

- (cash_close_id) → `cash_closes`(id) ON DELETE RESTRICT — `cashClose` (many-to-one)

Logical references (no FK):

- `payment_account_id` → payment_accounts — INFERRED (column name)

<a id="cash-closes"></a>
#### `CashClose` → `cash_closes`

> Immutable count of the counter since the previous close (D23, 5.16).

- **File:** `src/billing/entities/cash-close.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `period_start` | periodStart | timestamp with time zone | no |  |  |  |
| `period_end` | periodEnd | timestamp with time zone | no |  |  |  |
| `business_date` | businessDate | date | no |  |  |  |
| `total_expected` | totalExpected | numeric(12,2) | no |  |  |  |
| `total_counted` | totalCounted | numeric(12,2) | no | '0' |  |  |
| `total_variance` | totalVariance | numeric(12,2) | no |  |  |  |
| `note` | note | character varying(500) | yes |  |  |  |
| `closed_by` | closedBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_cash_closes_loc_end` (organization_id, location_id, period_end)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `closed_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="charges"></a>
#### `Charge` → `charges`

> One billable line for a patient — the atomic unit of billing (D1). `invoiceId = null` means unbilled. Price, discount and service kind are snapshots: catalog changes never touch existing charges (D5). Balance is never stored: `netAmount + taxAmount − allocatedAmount`.

- **File:** `src/billing/entities/charge.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `source` | source | enum(CONSULTATION, TREATMENT, TREATMENT_PLAN, MANUAL) | no |  |  |  |
| `source_id` | sourceId | uuid | yes |  | L |  |
| `encounter_id` | encounterId | uuid | yes |  | L | The visit (patient encounter) the charge comes from, when known. |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `doctor_id` | doctorId | uuid | yes |  | FK→`employees` |  |
| `service_id` | serviceId | uuid | yes |  | L |  |
| `performing_assignment_id` | performingAssignmentId | uuid | yes |  | FK→`employee_org_location_assignments` |  |
| `commission_plan_id` | commissionPlanId | uuid | yes |  | FK→`compensation_plans` |  |
| `commission_rate_bps` | commissionRateBps | integer | yes |  |  |  |
| `commission_fixed_minor` | commissionFixedMinor | bigint | yes |  |  |  |
| `service_kind` | serviceKind | enum(CONSULTATION, PROCEDURE, OTHER) | no | 'OTHER' |  | Snapshot; MANUAL "Other" charges count as OTHER for discount rules. |
| `description` | description | character varying(200) | no |  |  |  |
| `quantity` | quantity | integer | no | '1' |  |  |
| `unit_price` | unitPrice | numeric(12,2) | no | '0' |  |  |
| `gross_amount` | grossAmount | numeric(12,2) | no | '0' |  |  |
| `discount_type_id` | discountTypeId | uuid | yes |  | L |  |
| `discount_name` | discountName | character varying(80) | yes |  |  |  |
| `discount_kind` | discountKind | enum(PERCENTAGE, FIXED) | yes |  |  |  |
| `discount_value` | discountValue | numeric(12,2) | yes |  |  |  |
| `discount_amount` | discountAmount | numeric(12,2) | no | '0' |  |  |
| `discount_note` | discountNote | character varying(200) | yes |  |  |  |
| `discount_applied_by` | discountAppliedBy | uuid | yes |  | L |  |
| `is_custom_discount` | isCustomDiscount | boolean | no | false |  |  |
| `net_amount` | netAmount | numeric(12,2) | no | '0' |  |  |
| `tax_amount` | taxAmount | numeric(12,2) | no | '0' |  | This charge's share of its invoice's sales tax (0 while unbilled). Payable = net + tax; tax is not revenue and earns no commission. Written… |
| `allocated_amount` | allocatedAmount | numeric(12,2) | no | '0' |  | Cached = SUM(allocations.amount); written only by BillingTotalsService. |
| `invoice_id` | invoiceId | uuid | yes |  | FK→`invoices` |  |
| `charge_date` | chargeDate | date | no |  |  |  |
| `needs_pricing` | needsPricing | boolean | no | false |  |  |
| `status` | status | enum(ACTIVE, VOID) | no | 'ACTIVE' |  |  |
| `voided_at` | voidedAt | timestamp with time zone | yes |  |  |  |
| `voided_by` | voidedBy | uuid | yes |  | L |  |
| `void_reason` | voidReason | character varying(300) | yes |  |  |  |
| `source_removed_at` | sourceRemovedAt | timestamp with time zone | yes |  |  | Set when the doctor removed the source treatment after billing (6.4). |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_charges_source` (organization_id, source, source_id) WHERE status = 'ACTIVE' AND source_id IS NOT NULL
- INDEX `idx_charges_date` (organization_id, location_id, charge_date)
- INDEX `idx_charges_invoice` (invoice_id)
- INDEX `idx_charges_patient_open` (organization_id, location_id, patient_id, status, invoice_id)

Constraints:

- CHECK `chk_charges_commission_rate`: `"commission_rate_bps" IS NULL OR "commission_rate_bps" BETWEEN 0 AND 10000`

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)
- (doctor_id) → `employees`(id) ON DELETE RESTRICT — `doctor` (many-to-one)
- (performing_assignment_id) → `employee_org_location_assignments`(id) ON DELETE RESTRICT — `performingAssignment` (many-to-one)
- (commission_plan_id) → `compensation_plans`(id) ON DELETE RESTRICT — `commissionPlan` (many-to-one)
- (invoice_id) → `invoices`(id) ON DELETE RESTRICT — `invoice` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `source_id` → polymorphic — discriminated by `source_type` — VERIFIED polymorphic (type + id pair, no FK possible)
- `encounter_id` → patient_encounters — INFERRED (entity comment states target)
- `appointment_id` → appointments — INFERRED (column name)
- `service_id` → services — INFERRED (column name)
- `discount_type_id` → discount_types — INFERRED (column name)
- `discount_applied_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `voided_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="commission-entries"></a>
#### `CommissionEntry` → `commission_entries`

> Append-only commission ledger (signed paisa). For each charge, SUM(amount_minor) always equals the commission target for what has been collected on it; every change inserts only the difference. Amounts are never updated and rows are never deleted (a trigger enforces it); only `settlement_id` is set…

- **File:** `src/billing/commissions/entities/commission-entry.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `assignment_id` | assignmentId | uuid | no |  | FK→`employee_org_location_assignments` |  |
| `charge_id` | chargeId | uuid | yes |  | FK→`charges` |  |
| `lab_invoice_line_id` | labInvoiceLineId | uuid | yes |  | FK→`lab_invoice_lines` |  |
| `source_type` | sourceType | enum(ALLOCATION, UNAPPLY, CHARGE_ADJUST, VOID, MANUAL) | no |  |  |  |
| `source_id` | sourceId | uuid | no |  | L | The payment (new money) or the operation id that caused the entry. |
| `base_minor` | baseMinor | bigint | no | '0' |  | Collected on the charge (capped at net) when the entry was written. |
| `rate_bps` | rateBps | integer | yes |  |  |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  | Signed: negative reverses earlier commission. |
| `settlement_id` | settlementId | uuid | yes |  | FK→`commission_settlements` |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_commission_entries_charge` (charge_id)
- INDEX `idx_commission_entries_unsettled` (assignment_id) WHERE "settlement_id" IS NULL
- INDEX `idx_commission_entries_assignment` (assignment_id, created_at)
- INDEX `idx_commission_entries_lab_line` (lab_invoice_line_id)
- UNIQUE INDEX `uq_commission_entries_lab_source` (source_type, source_id, lab_invoice_line_id) WHERE "lab_invoice_line_id" IS NOT NULL
- UNIQUE INDEX `uq_commission_entries_source` (source_type, source_id, charge_id)

Constraints:

- CHECK `chk_commission_entries_target`: `("charge_id" IS NULL) <> ("lab_invoice_line_id" IS NULL)`

Foreign keys (enforced):

- (assignment_id) → `employee_org_location_assignments`(id) ON DELETE RESTRICT — `assignment` (many-to-one)
- (charge_id) → `charges`(id) ON DELETE RESTRICT — `charge` (many-to-one)
- (lab_invoice_line_id) → `lab_invoice_lines`(id) ON DELETE RESTRICT — `labInvoiceLine` (many-to-one)
- (settlement_id) → `commission_settlements`(id) ON DELETE RESTRICT — `settlement` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `source_id` → polymorphic — discriminated by `source_type` — VERIFIED polymorphic (type + id pair, no FK possible)

<a id="commission-rules"></a>
#### `CommissionRule` → `commission_rules`

> A plan override for one catalog service or one service category (`ServiceKind`): either a rate in basis points or a fixed amount per fully paid charge. Resolution: service rule → category rule → plan default.

- **File:** `src/billing/commissions/entities/commission-rule.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `plan_id` | planId | uuid | no |  | FK→`compensation_plans` |  |
| `service_id` | serviceId | uuid | yes |  | FK→`services` |  |
| `service_category` | serviceCategory | enum(CONSULTATION, PROCEDURE, OTHER) | yes |  |  |  |
| `rate_bps` | rateBps | integer | yes |  |  |  |
| `fixed_amount_minor` | fixedAmountMinor | bigint | yes |  |  |  |

Indexes and unique constraints:

- UNIQUE INDEX `uq_commission_rules_category` (plan_id, service_category) WHERE "service_category" IS NOT NULL
- UNIQUE INDEX `uq_commission_rules_service` (plan_id, service_id) WHERE "service_id" IS NOT NULL

Constraints:

- CHECK `chk_commission_rules_target`: `("service_id" IS NULL) <> ("service_category" IS NULL)`
- CHECK `chk_commission_rules_fixed`: `"fixed_amount_minor" IS NULL OR "fixed_amount_minor" >= 0`
- CHECK `chk_commission_rules_rate`: `"rate_bps" IS NULL OR "rate_bps" BETWEEN 0 AND 10000`
- CHECK `chk_commission_rules_amount`: `("rate_bps" IS NULL) <> ("fixed_amount_minor" IS NULL)`

Foreign keys (enforced):

- (plan_id) → `compensation_plans`(id) ON DELETE CASCADE — `plan` (many-to-one)
- (service_id) → `services`(id) ON DELETE CASCADE — `service` (many-to-one)

<a id="commission-settlements"></a>
#### `CommissionSettlement` → `commission_settlements`

> A batch of unsettled commission entries of one assignment, paid through one payroll record. Entries keep their amounts; they only point here.

- **File:** `src/billing/commissions/entities/commission-settlement.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `assignment_id` | assignmentId | uuid | no |  | FK→`employee_org_location_assignments` |  |
| `period_start` | periodStart | date | no |  |  |  |
| `period_end` | periodEnd | date | no |  |  |  |
| `total_minor` | totalMinor | bigint | no | '0' |  | Signed: a period with only reversals can be negative. |
| `status` | status | enum(PENDING, PAID) | no | 'PENDING' |  |  |
| `payroll_record_id` | payrollRecordId | uuid | yes |  | FK→`payroll_records` UQ |  |
| `paid_at` | paidAt | timestamp with time zone | yes |  |  |  |
| `paid_by` | paidBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `REL_84d2b57fc13fc9e8ad0435cbb3` (payroll_record_id)
- INDEX `idx_commission_settlements_assignment` (assignment_id, period_end)

Foreign keys (enforced):

- (assignment_id) → `employee_org_location_assignments`(id) ON DELETE RESTRICT — `assignment` (many-to-one)
- (payroll_record_id) → `payroll_records`(id) ON DELETE RESTRICT — `payrollRecord` (one-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `paid_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="compensation-plans"></a>
#### `CompensationPlan` → `compensation_plans`

> How one assignment (employee × location) is paid, valid for [effectiveFrom, effectiveTo] (inclusive; null `effectiveTo` = current). Versions never overlap (exclusion constraint, needs btree_gist); a change closes the current version and adds a new one, so old charges keep the rate they were snapsho…

- **File:** `src/billing/commissions/entities/compensation-plan.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `assignment_id` | assignmentId | uuid | no |  | FK→`employee_org_location_assignments` |  |
| `type` | type | enum(SALARY, COMMISSION, SALARY_PLUS_COMMISSION) | no |  |  |  |
| `base_salary_minor` | baseSalaryMinor | bigint | yes |  |  |  |
| `default_rate_bps` | defaultRateBps | integer | yes |  |  | Basis points: 4000 = 40.00%. |
| `commission_basis` | commissionBasis | enum(NET, GROSS) | no | 'NET' |  |  |
| `effective_from` | effectiveFrom | date | no |  |  |  |
| `effective_to` | effectiveTo | date | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_compensation_plans_assignment` (assignment_id, effective_from)

Constraints:

- CHECK `chk_compensation_plans_dates`: `"effective_to" IS NULL OR "effective_to" >= "effective_from"`
- CHECK `chk_compensation_plans_salary`: `"base_salary_minor" IS NULL OR "base_salary_minor" >= 0`
- CHECK `chk_compensation_plans_rate`: `"default_rate_bps" IS NULL OR "default_rate_bps" BETWEEN 0 AND 10000`
- CHECK `chk_compensation_plans_fields`: `("type" = 'SALARY' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NULL) OR ("type" = 'COMMISSION' AND "default_rate_bps" IS NOT NULL AND "base_salary_minor" IS NULL) OR ("type" = 'SALARY_PLUS_COMMISSION' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NOT NULL)`
- EXCLUDE `excl_compensation_plans_overlap`: `USING gist ("assignment_id" WITH =, daterange("effective_from", "effective_to", '[]') WITH &&)`

Foreign keys (enforced):

- (assignment_id) → `employee_org_location_assignments`(id) ON DELETE CASCADE — `assignment` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="credit-packages"></a>
#### `CreditPackage` → `credit_packages`

- **File:** `src/billing/entities/credit-package.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying(150) | no |  |  |  |
| `description` | description | text | yes |  |  |  |
| `total_credits` | totalCredits | numeric(10,2) | no |  |  |  |
| `price` | price | numeric(10,2) | no |  |  |  |
| `validity_days` | validityDays | integer | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_48f863578ece836f49b7ba21ab` (organization_id, is_active)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="discount-types"></a>
#### `DiscountType` → `discount_types`

> Owner-defined discount preset, evolved from coupons (D8, 5.6).

- **File:** `src/billing/entities/discount-type.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `name` | name | character varying(80) | no |  |  |  |
| `code` | code | character varying(30) | yes |  |  |  |
| `kind` | kind | enum(PERCENTAGE, FIXED) | no |  |  |  |
| `value` | value | numeric(12,2) | no |  |  |  |
| `max_amount` | maxAmount | numeric(12,2) | yes |  |  |  |
| `applies_to` | appliesTo | enum(ALL, SERVICE_KINDS, SERVICES) | no | 'ALL' |  |  |
| `service_kinds` | serviceKinds | enum(CONSULTATION, PROCEDURE, OTHER)[] | yes |  |  |  |
| `service_ids` | serviceIds | uuid[] | yes |  | L |  |
| `reception_editable` | receptionEditable | boolean | no | false |  |  |
| `min_value` | minValue | numeric(12,2) | yes |  |  |  |
| `max_value` | maxValue | numeric(12,2) | yes |  |  |  |
| `requires_note` | requiresNote | boolean | no | false |  |  |
| `valid_from` | validFrom | date | yes |  |  |  |
| `valid_to` | validTo | date | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_discount_types_org_code` (organization_id, code) WHERE code IS NOT NULL
- UNIQUE INDEX `uq_discount_types_org_name` (organization_id, name)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `service_ids` → services (uuid[]) — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="document-sequences"></a>
#### `DocumentSequence` → `document_sequences`

> Atomic per-location, per-type, per-year counter (D15, 6.11). Only touched through DocumentSequenceService.next() inside a transaction.

- **File:** `src/billing/entities/document-sequence.entity.ts`
- **PK:** `organization_id` + `location_id` + `doc_type` + `year` (uuid, no default — app supplies; uuid, no default — app supplies; enum, no default — app supplies; integer, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `organization_id` | organizationId | uuid | no |  | PK |  |
| `location_id` | locationId | uuid | no |  | PK |  |
| `doc_type` | docType | enum(INVOICE, RECEIPT, REFUND) | no |  | PK |  |
| `year` | year | integer | no |  | PK |  |
| `last_value` | lastValue | integer | no | '0' |  |  |

<a id="expenses"></a>
#### `Expense` → `expenses`

- **File:** `src/billing/entities/expense.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `category` | category | enum(RENT, UTILITIES, SUPPLIES, SALARY, EQUIPMENT, MARKETING, MAINTENANCE, OTHER) | no |  |  |  |
| `description` | description | character varying(300) | no |  |  |  |
| `amount` | amount | numeric(10,2) | no |  |  |  |
| `expense_date` | expenseDate | date | no |  |  |  |
| `payment_method` | paymentMethod | enum(CASH, CARD, BANK_TRANSFER, ONLINE, INSURANCE, CHEQUE, CREDIT_PACKAGE) | no |  |  |  |
| `reference_number` | referenceNumber | character varying(100) | yes |  |  |  |
| `receipt_url` | receiptUrl | text | yes |  |  |  |
| `recorded_by` | recordedBy | uuid | yes |  | FK→`employees` |  |
| `notes` | notes | text | yes |  |  |  |
| `lab_id` | labId | uuid | yes |  | L | Lab case cost (lab ERD §6c): the lab and / or lab order it was spent on. |
| `lab_order_id` | labOrderId | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `idx_expenses_lab_order` (lab_order_id)
- INDEX `IDX_5f5ca37aa197208ae47c6e33a1` (organization_id, category)
- INDEX `IDX_ac33e7e5e66487f65b57acd84f` (organization_id, location_id, expense_date)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (recorded_by) → `employees`(id) ON DELETE SET NULL — `recorder` (many-to-one)

Logical references (no FK):

- `lab_id` → labs — INFERRED (column name)
- `lab_order_id` → lab_orders — INFERRED (column name)

<a id="invoices"></a>
#### `Invoice` → `invoices`

> An issued document grouping charges (D2). No drafts: it is created and issued in one step. Cached money columns are written only by BillingTotalsService (6.12); payment / refund status is computed (6.13).

- **File:** `src/billing/entities/invoice.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `invoice_number` | invoiceNumber | character varying(30) | no |  |  |  |
| `status` | status | enum(ISSUED, CANCELLED) | no | 'ISSUED' |  |  |
| `revision` | revision | integer | no | '1' |  |  |
| `issue_date` | issueDate | date | no |  |  |  |
| `issued_at` | issuedAt | timestamp with time zone | no |  |  |  |
| `due_date` | dueDate | date | no |  |  |  |
| `subtotal` | subtotal | numeric(12,2) | no | '0' |  |  |
| `discount_total` | discountTotal | numeric(12,2) | no | '0' |  |  |
| `tax_rate` | taxRate | numeric(5,2) | no | '0' |  | Sales-tax rate (%) snapshotted from the location's settings when the invoice was issued. Edits re-apply this rate; later setting changes ne… |
| `tax_amount` | taxAmount | numeric(12,2) | no | '0' |  | Exclusive tax = SUM(ACTIVE charges.tax_amount) = round(net × rate). |
| `total_amount` | totalAmount | numeric(12,2) | no | '0' |  | subtotal − discount + tax. |
| `paid_amount` | paidAmount | numeric(12,2) | no | '0' |  |  |
| `balance_due` | balanceDue | numeric(12,2) | no | '0' |  |  |
| `released_amount` | releasedAmount | numeric(12,2) | no | '0' |  | Money released from this invoice to advance (edit releases + unapply). |
| `refunded_amount` | refundedAmount | numeric(12,2) | no | '0' |  | SUM(refunds.amount) recorded against this invoice. |
| `notes` | notes | character varying(500) | yes |  |  |  |
| `issued_by` | issuedBy | uuid | no |  | L |  |
| `last_edited_at` | lastEditedAt | timestamp with time zone | yes |  |  |  |
| `last_edited_by` | lastEditedBy | uuid | yes |  | L |  |
| `cancelled_at` | cancelledAt | timestamp with time zone | yes |  |  |  |
| `cancelled_by` | cancelledBy | uuid | yes |  | L |  |
| `cancel_reason` | cancelReason | character varying(300) | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `idx_invoices_open` (organization_id, location_id, status, balance_due)
- INDEX `idx_invoices_issue_date` (organization_id, location_id, issue_date)
- INDEX `idx_invoices_patient` (organization_id, location_id, patient_id)
- UNIQUE INDEX `uq_invoices_org_number` (organization_id, invoice_number)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `issued_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `last_edited_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `cancelled_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="ledger-entries"></a>
#### `LedgerEntry` → `ledger_entries`

> Append-only line of the patient statement (D18). Exactly one of debit / credit is > 0. Balance sign: + patient owes, − clinic holds advance.

- **File:** `src/billing/entities/ledger-entry.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `patient_id` | patientId | uuid | no |  | L |  |
| `type` | type | enum(INVOICE_ISSUED, INVOICE_ADJUSTED, INVOICE_CANCELLED, PAYMENT, REFUND) | no |  |  |  |
| `entry_date` | entryDate | date | no |  |  |  |
| `debit` | debit | numeric(12,2) | no | '0' |  |  |
| `credit` | credit | numeric(12,2) | no | '0' |  |  |
| `invoice_id` | invoiceId | uuid | yes |  | L |  |
| `payment_id` | paymentId | uuid | yes |  | L |  |
| `refund_id` | refundId | uuid | yes |  | L |  |
| `invoice_revision` | invoiceRevision | integer | yes |  |  |  |
| `description` | description | character varying(200) | no |  |  |  |
| `created_by` | createdBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_ledger_patient` (organization_id, location_id, patient_id, entry_date, created_at)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `patient_id` → patients — INFERRED (column name)
- `invoice_id` → invoices — INFERRED (column name)
- `payment_id` → payments — INFERRED (column name)
- `refund_id` → refunds — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="ledger-journal-lines"></a>
#### `LedgerJournalLine` → `ledger_journal_lines`

> One side of a journal (lab ERD §6c `ledger_entries`). Never updated or deleted.

- **File:** `src/billing/ledger/journal/ledger-journal.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `journal_id` | journalId | uuid | no |  | FK→`ledger_journals` |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | yes |  | L |  |
| `account_code` | accountCode | character varying(40) | no |  |  |  |
| `debit_minor` | debitMinor | bigint | no | '0' |  |  |
| `credit_minor` | creditMinor | bigint | no | '0' |  |  |
| `patient_id` | patientId | uuid | yes |  | L |  |
| `lab_id` | labId | uuid | yes |  | L |  |
| `doctor_id` | doctorId | uuid | yes |  | L |  |
| `lab_order_id` | labOrderId | uuid | yes |  | L |  |

Indexes and unique constraints:

- INDEX `idx_ledger_journal_lines_lab` (lab_id)
- INDEX `idx_ledger_journal_lines_account` (organization_id, account_code)
- INDEX `idx_ledger_journal_lines_journal` (journal_id)

Constraints:

- CHECK `chk_ledger_journal_lines_side`: `("debit_minor" > 0 AND "credit_minor" = 0) OR ("credit_minor" > 0 AND "debit_minor" = 0)`

Foreign keys (enforced):

- (journal_id) → `ledger_journals`(id) ON DELETE RESTRICT — `journal` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `patient_id` → patients — INFERRED (column name)
- `lab_id` → labs — INFERRED (column name)
- `doctor_id` → employees — INFERRED (column name)
- `lab_order_id` → lab_orders — INFERRED (column name)

<a id="ledger-journals"></a>
#### `LedgerJournal` → `ledger_journals`

> A balanced double-entry journal (lab ERD §6c `ledger_journals`). Billing v2's `ledger_entries` is the patient statement (one-sided, rupees), so the general ledger lives next to it in its own two tables. Append-only: a correction is a mirror journal with `reversal_of_id`.

- **File:** `src/billing/ledger/journal/ledger-journal.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | yes |  | L |  |
| `entry_on` | entryOn | date | no |  |  |  |
| `source_type` | sourceType | enum(vendor_bill, vendor_payment, expense, invoice, payment, credit_note, refund, commission) | no |  |  |  |
| `source_id` | sourceId | uuid | no |  | L |  |
| `reversal_of_id` | reversalOfId | uuid | yes |  | L |  |
| `memo` | memo | character varying(200) | no |  |  |  |
| `total_minor` | totalMinor | bigint | no | '0' |  | Σ debit = Σ credit of the lines. |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_ledger_journals_reversal` (reversal_of_id) WHERE "reversal_of_id" IS NOT NULL
- INDEX `idx_ledger_journals_source` (organization_id, source_type, source_id)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `source_id` → polymorphic — discriminated by `source_type` — VERIFIED polymorphic (type + id pair, no FK possible)
- `reversal_of_id` → ledger_journals (self) — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="location-billing-settings"></a>
#### `LocationBillingSettings` → `location_billing_settings`

> Billing settings of one location (5.4), created lazily with defaults. `documentCode` is the `{LOC}` part of document numbers. It lives here instead of `locations.code` because that column is a free-form, required code (up to 50 chars) that does not fit `^[A-Z0-9]{2,6}$` (V5); it is seeded from it w…

- **File:** `src/billing/entities/location-billing-settings.entity.ts`
- **PK:** `location_id` (uuid, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `location_id` | locationId | uuid | no |  | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `document_code` | documentCode | character varying(6) | yes |  |  |  |
| `due_days` | dueDays | integer | no | '7' |  |  |
| `invoice_print_format` | invoicePrintFormat | enum(A4, THERMAL_80) | no | 'A4' |  |  |
| `receipt_print_format` | receiptPrintFormat | enum(A4, THERMAL_80) | no | 'A4' |  |  |
| `show_logo` | showLogo | boolean | no | true |  |  |
| `show_previous_balance` | showPreviousBalance | boolean | no | true |  |  |
| `show_outstanding_at_check_in` | showOutstandingAtCheckIn | boolean | no | true |  |  |
| `footer_note` | footerNote | character varying(300) | yes |  |  |  |
| `default_consultation_service_id` | defaultConsultationServiceId | uuid | yes |  | L |  |
| `default_payment_account_id` | defaultPaymentAccountId | uuid | yes |  | L |  |
| `cash_variance_alert_amount` | cashVarianceAlertAmount | numeric(12,2) | no | '0' |  |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `default_consultation_service_id` → services — INFERRED (column name)
- `default_payment_account_id` → payment_accounts — INFERRED (column name)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-credits"></a>
#### `PatientCredit` → `patient_credits`

- **File:** `src/billing/entities/patient-credit.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `credit_package_id` | creditPackageId | uuid | yes |  | FK→`credit_packages` |  |
| `purchased_by` | purchasedBy | uuid | yes |  | FK→`employees` |  |
| `total_amount` | totalAmount | numeric(10,2) | no |  |  |  |
| `used_amount` | usedAmount | numeric(10,2) | no | '0' |  |  |
| `remaining_amount` | remainingAmount | numeric(10,2) | no |  |  |  |
| `purchase_date` | purchaseDate | date | no |  |  |  |
| `expiry_date` | expiryDate | date | yes |  |  |  |
| `status` | status | enum(ACTIVE, EXPIRED, EXHAUSTED) | no | 'ACTIVE' |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_e253a50407038ab2da45acb242` (patient_id, organization_id, status)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (credit_package_id) → `credit_packages`(id) ON DELETE SET NULL — `creditPackage` (many-to-one)
- (purchased_by) → `employees`(id) ON DELETE SET NULL — `purchaser` (many-to-one)

<a id="payment-accounts"></a>
#### `PaymentAccount` → `payment_accounts`

> A location's way to receive money: Cash, Meezan Bank, JazzCash… (D20).

- **File:** `src/billing/entities/payment-account.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `name` | name | character varying(60) | no |  |  |  |
| `method` | method | enum(CASH, CARD, BANK_TRANSFER, CHEQUE, ONLINE_WALLET) | no |  |  |  |
| `bank_name` | bankName | character varying(80) | yes |  |  |  |
| `account_title` | accountTitle | character varying(120) | yes |  |  |  |
| `account_number` | accountNumber | character varying(40) | yes |  |  |  |
| `requires_reference` | requiresReference | boolean | no | false |  |  |
| `counted_in_cash_close` | countedInCashClose | boolean | no | false |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `sort_order` | sortOrder | integer | no | '0' |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_payment_accounts_loc_name` (organization_id, location_id, name)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)

<a id="payment-allocations"></a>
#### `PaymentAllocation` → `payment_allocations`

> Append-only, signed: "X of payment P applied to charge C" (+) or released back to advance (−). Never updated or deleted (D13).

- **File:** `src/billing/entities/payment-allocation.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `patient_id` | patientId | uuid | no |  | L |  |
| `payment_id` | paymentId | uuid | no |  | FK→`payments` |  |
| `charge_id` | chargeId | uuid | no |  | FK→`charges` |  |
| `invoice_id` | invoiceId | uuid | no |  | L | Copy of the charge's invoice at write time (fast invoice queries). |
| `amount` | amount | numeric(12,2) | no |  |  |  |
| `reason` | reason | enum(PAYMENT, ADVANCE_APPLIED, INVOICE_EDIT_RELEASE, UNAPPLY) | no |  |  |  |
| `note` | note | character varying(300) | yes |  |  |  |
| `created_by` | createdBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_payment_allocations_invoice` (invoice_id)
- INDEX `idx_payment_allocations_charge` (charge_id)
- INDEX `idx_payment_allocations_payment` (payment_id)

Constraints:

- CHECK `chk_payment_allocations_amount_nonzero`: `amount <> 0`

Foreign keys (enforced):

- (payment_id) → `payments`(id) ON DELETE RESTRICT — `payment` (many-to-one)
- (charge_id) → `charges`(id) ON DELETE RESTRICT — `charge` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `patient_id` → patients — INFERRED (column name)
- `invoice_id` → invoices — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="payments"></a>
#### `Payment` → `payments`

> Money received from a patient (D6, D12). Belongs to the patient, not to an invoice; immutable except the cached `allocatedAmount` / `refundedAmount`. Advance = amount − allocated − refunded.

- **File:** `src/billing/entities/payment.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `receipt_number` | receiptNumber | character varying(30) | no |  |  |  |
| `amount` | amount | numeric(12,2) | no | '0' |  |  |
| `payment_account_id` | paymentAccountId | uuid | no |  | FK→`payment_accounts` |  |
| `method` | method | enum(CASH, CARD, BANK_TRANSFER, CHEQUE, ONLINE_WALLET) | no |  |  | Snapshot of the account's kind at payment time. |
| `payment_account_name` | paymentAccountName | character varying(60) | no |  |  | Snapshot of the account's name. |
| `reference_number` | referenceNumber | character varying(80) | yes |  |  |  |
| `payment_date` | paymentDate | date | no |  |  |  |
| `received_at` | receivedAt | timestamp with time zone | no |  |  |  |
| `received_by` | receivedBy | uuid | no |  | L |  |
| `notes` | notes | character varying(300) | yes |  |  |  |
| `allocated_amount` | allocatedAmount | numeric(12,2) | no | '0' |  |  |
| `refunded_amount` | refundedAmount | numeric(12,2) | no | '0' |  |  |
| `client_request_id` | clientRequestId | uuid | no |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_payments_account_received` (payment_account_id, received_at)
- INDEX `idx_payments_date` (organization_id, location_id, payment_date)
- INDEX `idx_payments_patient` (organization_id, location_id, patient_id)
- UNIQUE INDEX `uq_payments_org_client_request` (organization_id, client_request_id)
- UNIQUE INDEX `uq_payments_org_receipt` (organization_id, receipt_number)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)
- (payment_account_id) → `payment_accounts`(id) ON DELETE RESTRICT — `paymentAccount` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `received_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="refund-sources"></a>
#### `RefundSource` → `refund_sources`

> Which payment's advance funded a refund. SUM = refund.amount (I7).

- **File:** `src/billing/entities/refund-source.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `refund_id` | refundId | uuid | no |  | FK→`refunds` |  |
| `payment_id` | paymentId | uuid | no |  | FK→`payments` |  |
| `amount` | amount | numeric(12,2) | no | '0' |  |  |

Indexes and unique constraints:

- INDEX `idx_refund_sources_payment` (payment_id)
- INDEX `idx_refund_sources_refund` (refund_id)

Foreign keys (enforced):

- (refund_id) → `refunds`(id) ON DELETE RESTRICT — `refund` (many-to-one)
- (payment_id) → `payments`(id) ON DELETE RESTRICT — `payment` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

<a id="refunds"></a>
#### `Refund` → `refunds`

> Money returned to a patient, always taken from advance (D14). `invoiceId` set = invoice refund (6.18); null = advance refund.

- **File:** `src/billing/entities/refund.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `refund_number` | refundNumber | character varying(30) | no |  |  |  |
| `amount` | amount | numeric(12,2) | no | '0' |  |  |
| `payment_account_id` | paymentAccountId | uuid | no |  | L |  |
| `method` | method | enum(CASH, CARD, BANK_TRANSFER, CHEQUE, ONLINE_WALLET) | no |  |  |  |
| `payment_account_name` | paymentAccountName | character varying(60) | no |  |  |  |
| `reference_number` | referenceNumber | character varying(80) | yes |  |  |  |
| `reason` | reason | character varying(300) | no |  |  |  |
| `refund_date` | refundDate | date | no |  |  |  |
| `refunded_at` | refundedAt | timestamp with time zone | no |  |  |  |
| `refunded_by` | refundedBy | uuid | no |  | L |  |
| `invoice_id` | invoiceId | uuid | yes |  | L |  |
| `client_request_id` | clientRequestId | uuid | no |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_refunds_account_refunded` (payment_account_id, refunded_at)
- INDEX `idx_refunds_invoice` (invoice_id)
- INDEX `idx_refunds_patient` (organization_id, location_id, patient_id)
- UNIQUE INDEX `uq_refunds_org_client_request` (organization_id, client_request_id)
- UNIQUE INDEX `uq_refunds_org_number` (organization_id, refund_number)

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `payment_account_id` → payment_accounts — INFERRED (column name)
- `refunded_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `invoice_id` → invoices — INFERRED (column name)

<a id="service-prices"></a>
#### `ServicePrice` → `service_prices`

> Price override of a catalog service for a location, optionally for one doctor (5.3). Doctors are employees, same as queue sessions (V4).

- **File:** `src/billing/entities/service-price.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `service_id` | serviceId | uuid | no |  | FK→`services` |  |
| `doctor_id` | doctorId | uuid | yes |  | FK→`employees` |  |
| `price` | price | numeric(12,2) | no | '0' |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_service_prices_loc_doc` (service_id, location_id, doctor_id) WHERE doctor_id IS NOT NULL
- UNIQUE INDEX `uq_service_prices_loc` (service_id, location_id) WHERE doctor_id IS NULL

Foreign keys (enforced):

- (service_id) → `services`(id) ON DELETE RESTRICT — `service` (many-to-one)
- (doctor_id) → `employees`(id) ON DELETE RESTRICT — `doctor` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)

<a id="services"></a>
#### `CatalogService` → `services`

> Org-level service catalog: consultation, procedures, other (D5).

- **File:** `src/billing/entities/catalog-service.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `name` | name | character varying(120) | no |  |  |  |
| `code` | code | character varying(30) | yes |  |  |  |
| `kind` | kind | enum(CONSULTATION, PROCEDURE, OTHER) | no |  |  |  |
| `default_price` | defaultPrice | numeric(12,2) | no | '0' |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `sort_order` | sortOrder | integer | no | '0' |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `idx_services_org_active_kind` (organization_id, is_active, kind)
- UNIQUE INDEX `uq_services_org_code` (organization_id, code) WHERE code IS NOT NULL
- UNIQUE INDEX `uq_services_org_name` (organization_id, name)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

### Module `inventory`

<a id="consumption-template-items"></a>
#### `ConsumptionTemplateItem` → `consumption_template_items`

- **File:** `src/inventory/entities/consumption-template-item.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `templateId` | templateId | uuid | no |  | FK→`consumption_templates` |  |
| `inventoryItemId` | inventoryItemId | uuid | no |  | FK→`inventory_items` |  |
| `quantity` | quantity | numeric(10,2) | no |  |  | eager: true so item name, unit, price auto-loads with template |
| `notes` | notes | character varying | yes |  |  | Default suggested quantity for this procedure Example: Gloves = 2 pairs, Anesthetic = 1 cartridge |
| `sortOrder` | sortOrder | integer | no | '0' |  | Hints for doctor: "use 2 if molar", "optional for minor cases" |

Indexes and unique constraints:

- INDEX `IDX_c85068bde5797f4b11c65fc394` (templateId)

Foreign keys (enforced):

- (templateId) → `consumption_templates`(id) ON DELETE CASCADE — `template` (many-to-one)
- (inventoryItemId) → `inventory_items`(id) ON DELETE NO ACTION — `inventoryItem` (many-to-one)

<a id="consumption-templates"></a>
#### `ConsumptionTemplate` → `consumption_templates`

- **File:** `src/inventory/entities/consumption-template.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `createdAt` (create), `updatedAt` (update)
- **Soft delete:** `isActive` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organizationId` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying | no |  |  |  |
| `procedureName` | procedureName | character varying | no |  |  | Example: "Root Canal Kit", "Teeth Cleaning Kit", "Extraction Kit", "Facial Treatment Kit" |
| `appointmentType` | appointmentType | character varying | yes |  |  | Example: "Root Canal", "Teeth Cleaning", "Extraction", "Chemical Peel" |
| `isActive` | isActive | boolean | no | true |  | Maps to your existing appointment type enum (CONSULTATION, ROOT_CANAL, EXTRACTION etc.) Used for AUTO-MATCHING: when doctor starts this typ… |
| `createdAt` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updatedAt` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_d40fa6e1a5d3ec405e4bf1cce4` (organizationId, appointmentType)
- INDEX `IDX_86b50c3096ce35742bf29bd5bc` (organizationId, isActive)

Foreign keys (enforced):

- (organizationId) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="inventory"></a>
#### `Inventory` → `inventory`

- **File:** `src/inventory/entities/inventory.entity.ts` — ⚠ not registered in any `forFeature` (CLI glob only)
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organization_id` | organizationId | uuid | yes |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `item_name` | itemName | character varying(255) | no |  |  |  |
| `quantity` | quantity | integer | no | '0' |  |  |
| `unit_price` | unitPrice | numeric(10,2) | no | '0' |  |  |
| `expiry_date` | expiryDate | date | yes |  |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_4fc4672e0c04a072ff00651452` (organization_id)
- INDEX `IDX_1eea99c8c645d7541002473a01` (location_id)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

<a id="inventory-categories"></a>
#### `InventoryCategory` → `inventory_categories`

- **File:** `src/inventory/entities/inventory-category.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `createdAt` (create), `updatedAt` (update)
- **Soft delete:** `isActive` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organizationId` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying | no |  |  |  |
| `description` | description | text | yes |  |  | Examples: "Disposables", "Dental Materials", "Medicines", "Instruments", "Office Supplies", "Sterilization" |
| `sortOrder` | sortOrder | integer | no | '0' |  |  |
| `isActive` | isActive | boolean | no | true |  |  |
| `createdAt` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updatedAt` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_4771b9e2b38a401250f0a7b76f` (organizationId, isActive)

Foreign keys (enforced):

- (organizationId) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

<a id="inventory-items"></a>
#### `InventoryItem` → `inventory_items`

- **File:** `src/inventory/entities/inventory-item.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `createdAt` (create), `updatedAt` (update)
- **Soft delete:** `isActive` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organizationId` | organizationId | uuid | no |  | FK→`organizations` |  |
| `locationId` | locationId | uuid | no |  | FK→`locations` |  |
| `categoryId` | categoryId | uuid | yes |  | FK→`inventory_categories` |  |
| `name` | name | character varying | no |  |  |  |
| `sku` | sku | character varying | yes |  |  | Example: "Disposable Gloves (Medium)", "Composite A2", "Lidocaine 2% Cartridge" |
| `barcode` | barcode | character varying | yes |  |  | Internal stock keeping code: "GLV-M-001", "CMP-A2-01" Unique per organization (not globally) — enforced in service, not DB constraint becau… |
| `description` | description | text | yes |  |  | For future barcode/QR scanning feature |
| `currentStock` | currentStock | numeric(10,2) | no | '0' |  |  |
| `unit` | unit | enum(pieces, boxes, pairs, rolls, bottles, packets, cartridges, tubes, ml, gm, kg, liters) | no | 'pieces' |  | NEVER update directly — always through StockMovement via adjustStock() method |
| `unitPrice` | unitPrice | numeric(10,2) | no | '0' |  |  |
| `sellingPrice` | sellingPrice | numeric(10,2) | yes |  |  | Last purchase/cost price per unit — updated when PO items are received |
| `reorderLevel` | reorderLevel | integer | no | '10' |  | If this item is directly billable to patient (e.g. special materials) |
| `reorderQuantity` | reorderQuantity | integer | no | '50' |  | Alert when currentStock drops to or below this number |
| `maxStock` | maxStock | integer | yes |  |  | Suggested quantity to order when reordering |
| `expiryDate` | expiryDate | date | yes |  |  | Maximum storage capacity — optional, for warehouse management |
| `expiryAlertDays` | expiryAlertDays | integer | no | '30' |  | Nearest expiry date among current stock batches Updated when new stock received or expired stock removed |
| `isBillable` | isBillable | boolean | no | false |  | Alert N days before expiryDate |
| `isActive` | isActive | boolean | no | true |  | Can this item be added to patient invoice as a line item? |
| `createdAt` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updatedAt` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_e6388b43e4c91fe4940c6fa049` (expiryDate)
- INDEX `IDX_9165e9e2878b6d644276523ece` (organizationId, locationId, currentStock)
- INDEX `IDX_d555f1a6809cd25a091754e90b` (organizationId, locationId, isActive)

Foreign keys (enforced):

- (organizationId) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (locationId) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (categoryId) → `inventory_categories`(id) ON DELETE SET NULL — `category` (many-to-one)

<a id="patient-consumption-items"></a>
#### `PatientConsumptionItem` → `patient_consumption_items`

- **File:** `src/inventory/entities/patient-consumption-item.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `consumptionId` | consumptionId | uuid | no |  | FK→`patient_consumptions` |  |
| `inventoryItemId` | inventoryItemId | uuid | no |  | FK→`inventory_items` |  |
| `quantity` | quantity | numeric(10,2) | no |  |  |  |
| `unitPrice` | unitPrice | numeric(10,2) | no |  |  | Actual quantity doctor used — may differ from template suggestion |
| `totalPrice` | totalPrice | numeric(10,2) | no |  |  | Snapshot of item's unitPrice at time of consumption Important: prices change over time, we need the price AT consumption time |
| `wasFromTemplate` | wasFromTemplate | boolean | no | false |  | quantity × unitPrice — calculated in service |
| `sortOrder` | sortOrder | integer | no | '0' |  | true = this item was auto-suggested from template false = doctor manually added this item |

Indexes and unique constraints:

- INDEX `IDX_7b5cabb8bcb2ea11014e879b7e` (consumptionId)

Foreign keys (enforced):

- (consumptionId) → `patient_consumptions`(id) ON DELETE CASCADE — `consumption` (many-to-one)
- (inventoryItemId) → `inventory_items`(id) ON DELETE NO ACTION — `inventoryItem` (many-to-one)

<a id="patient-consumptions"></a>
#### `PatientConsumption` → `patient_consumptions`

- **File:** `src/inventory/entities/patient-consumption.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `createdAt` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organizationId` | organizationId | uuid | no |  | FK→`organizations` |  |
| `locationId` | locationId | uuid | no |  | FK→`locations` |  |
| `patientId` | patientId | uuid | no |  | FK→`patients` |  |
| `appointmentId` | appointmentId | uuid | yes |  | FK→`appointments` |  |
| `treatmentPlanId` | treatmentPlanId | uuid | yes |  | L |  |
| `templateId` | templateId | uuid | yes |  | FK→`consumption_templates` | Not a FK relation to avoid circular — just store ID for reference |
| `performedBy` | performedBy | uuid | no |  | FK→`employees` | Which template was used as base — null if fully manual entry |
| `totalCost` | totalCost | numeric(10,2) | no | '0' |  |  |
| `notes` | notes | text | yes |  |  | SUM of all item totalPrices — calculated in service |
| `createdAt` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_a836f1c7d63c9b4d97e7346632` (appointmentId)
- INDEX `IDX_27522d5b6481ebd8b37bcc8062` (patientId)
- INDEX `IDX_cb88c02cd9070694e79371a0cf` (organizationId, locationId, createdAt)

Foreign keys (enforced):

- (organizationId) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (locationId) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (patientId) → `patients`(id) ON DELETE CASCADE — `patient` (many-to-one)
- (appointmentId) → `appointments`(id) ON DELETE SET NULL — `appointment` (many-to-one)
- (templateId) → `consumption_templates`(id) ON DELETE SET NULL — `template` (many-to-one)
- (performedBy) → `employees`(id) ON DELETE NO ACTION — `doctor` (many-to-one)

Logical references (no FK):

- `treatmentPlanId` → patient_treatment_plans (or treatment_plan_templates — not verified) — INFERRED (column name)

<a id="purchase-order-items"></a>
#### `PurchaseOrderItem` → `purchase_order_items`

- **File:** `src/inventory/entities/purchase-order-item.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `purchaseOrderId` | purchaseOrderId | uuid | no |  | FK→`purchase_orders` |  |
| `inventoryItemId` | inventoryItemId | uuid | no |  | FK→`inventory_items` |  |
| `orderedQuantity` | orderedQuantity | numeric(10,2) | no |  |  |  |
| `receivedQuantity` | receivedQuantity | numeric(10,2) | no | '0' |  |  |
| `unitPrice` | unitPrice | numeric(10,2) | no |  |  |  |
| `totalPrice` | totalPrice | numeric(10,2) | no |  |  |  |
| `batchNumber` | batchNumber | character varying | yes |  |  | orderedQuantity × unitPrice — calculated in service before save |
| `expiryDate` | expiryDate | date | yes |  |  |  |
| `notes` | notes | character varying | yes |  |  |  |
| `sortOrder` | sortOrder | integer | no | '0' |  |  |

Indexes and unique constraints:

- INDEX `IDX_1de7eb246940b05765d2c99a7e` (purchaseOrderId)

Foreign keys (enforced):

- (purchaseOrderId) → `purchase_orders`(id) ON DELETE CASCADE — `purchaseOrder` (many-to-one)
- (inventoryItemId) → `inventory_items`(id) ON DELETE NO ACTION — `inventoryItem` (many-to-one)

<a id="purchase-orders"></a>
#### `PurchaseOrder` → `purchase_orders`

- **File:** `src/inventory/entities/purchase-order.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `createdAt` (create), `updatedAt` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `poNumber` | poNumber | character varying | no |  | UQ |  |
| `organizationId` | organizationId | uuid | no |  | FK→`organizations` | Auto-generated: "PO-2024-00001" per organization |
| `locationId` | locationId | uuid | no |  | FK→`locations` |  |
| `supplierId` | supplierId | uuid | no |  | FK→`suppliers` |  |
| `createdBy` | createdBy | uuid | no |  | FK→`employees` |  |
| `status` | status | enum(DRAFT, ORDERED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED) | no | 'DRAFT' |  |  |
| `subtotal` | subtotal | numeric(10,2) | no | '0' |  |  |
| `taxRate` | taxRate | numeric(5,2) | no | '0' |  |  |
| `taxAmount` | taxAmount | numeric(10,2) | no | '0' |  |  |
| `totalAmount` | totalAmount | numeric(10,2) | no | '0' |  |  |
| `orderDate` | orderDate | date | yes |  |  |  |
| `expectedDeliveryDate` | expectedDeliveryDate | date | yes |  |  |  |
| `receivedDate` | receivedDate | date | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `createdAt` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updatedAt` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_2e0fc7a6605393a9bd691cdcebe` (poNumber)
- INDEX `IDX_0c3ff892a9f2ed16f59d31ccca` (supplierId)
- INDEX `IDX_7fb67d717b28cb26bb88b88217` (organizationId, locationId, status)

Foreign keys (enforced):

- (organizationId) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (locationId) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)
- (supplierId) → `suppliers`(id) ON DELETE NO ACTION — `supplier` (many-to-one)
- (createdBy) → `employees`(id) ON DELETE NO ACTION — `creator` (many-to-one)

<a id="stock-movements"></a>
#### `StockMovement` → `stock_movements`

- **File:** `src/inventory/entities/stock-movement.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `createdAt` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `inventoryItemId` | inventoryItemId | uuid | no |  | FK→`inventory_items` |  |
| `organizationId` | organizationId | character varying | no |  | L |  |
| `locationId` | locationId | character varying | no |  | L |  |
| `movementType` | movementType | enum(PURCHASE_IN, MANUAL_ADJUSTMENT, CONSUMPTION, WASTAGE, TRANSFER_IN, TRANSFER_OUT, RETURN_TO_SUPPLIER, INITIAL_STOCK) | no |  |  |  |
| `quantity` | quantity | numeric(10,2) | no |  |  |  |
| `previousStock` | previousStock | numeric(10,2) | no |  |  | Positive = stock coming IN (PURCHASE_IN, MANUAL_ADJUSTMENT up, TRANSFER_IN, INITIAL_STOCK) Negative = stock going OUT (CONSUMPTION, WASTAGE… |
| `newStock` | newStock | numeric(10,2) | no |  |  | Snapshot of item.currentStock BEFORE this movement |
| `referenceType` | referenceType | character varying | yes |  |  | Snapshot of item.currentStock AFTER this movement newStock = previousStock + quantity |
| `referenceId` | referenceId | character varying | yes |  | L | What triggered this movement: 'purchase_order' \| 'appointment' \| 'treatment_plan' \| 'manual' \| 'transfer' |
| `batchNumber` | batchNumber | character varying | yes |  |  | ID of the purchase order, appointment, etc. |
| `expiryDate` | expiryDate | date | yes |  |  | Batch/lot number for tracking specific batches |
| `notes` | notes | text | yes |  |  | Expiry date of this specific batch (different batches can have different expiry) |
| `performedBy` | performedBy | uuid | no |  | FK→`employees` |  |
| `createdAt` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_17e3734d294fe84a440c9f304d` (referenceType, referenceId)
- INDEX `IDX_59900bc3fb5e34a2a42d5c7f48` (organizationId, locationId, movementType)
- INDEX `IDX_9c95ee217cb681d3451a8f4fd7` (inventoryItemId, createdAt)

Foreign keys (enforced):

- (inventoryItemId) → `inventory_items`(id) ON DELETE CASCADE — `inventoryItem` (many-to-one)
- (performedBy) → `employees`(id) ON DELETE NO ACTION — `performer` (many-to-one)

Logical references (no FK):

- `organizationId` → organizations — INFERRED (column name)
- `locationId` → locations — INFERRED (column name)
- `referenceId` → polymorphic — discriminated by `referenceType` (if present) — VERIFIED polymorphic (type + id pair, no FK possible)

<a id="suppliers"></a>
#### `Supplier` → `suppliers`

- **File:** `src/inventory/entities/supplier.entity.ts`
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `createdAt` (create), `updatedAt` (update)
- **Soft delete:** `isActive` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `organizationId` | organizationId | uuid | no |  | FK→`organizations` |  |
| `name` | name | character varying | no |  |  |  |
| `contactPerson` | contactPerson | character varying | yes |  |  | Example: "PakDent Supplies Karachi", "Dental Depot Lahore" |
| `phone` | phone | character varying | yes |  |  |  |
| `email` | email | character varying | yes |  |  |  |
| `address` | address | text | yes |  |  |  |
| `city` | city | character varying | yes |  |  |  |
| `website` | website | character varying | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `isActive` | isActive | boolean | no | true |  | Payment terms, delivery schedule, preferred contact method |
| `createdAt` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updatedAt` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_6bd92e7904b376776c53f6151d` (organizationId, isActive)

Foreign keys (enforced):

- (organizationId) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

### Module `chairs`

<a id="chairs"></a>
#### `Chair` → `chairs`

- **File:** `src/chairs/entities/chair.entity.ts` — ⚠ not registered in any `forFeature` (CLI glob only)
- **PK:** `id` (uuid, generated: uuid)
- **Tenant scope:** organization ✘ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | generated (uuid) | PK |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `name` | name | character varying(100) | no |  |  |  |
| `code` | code | character varying(20) | no |  |  |  |
| `description` | description | text | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp without time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp without time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `IDX_a104d3b270dd88b0cbfd230bba` (location_id, is_active)

Foreign keys (enforced):

- (location_id) → `locations`(id) ON DELETE CASCADE — `location` (many-to-one)

### Module `notifications`

<a id="notification-audience-settings"></a>
#### `NotificationAudienceSetting` → `notification_audience_settings`

> Per-clinic master switch and quiet hours for one audience. Rows are created lazily on first change; a missing row means the defaults in `defaultAudienceEnabled` (patient OFF).

- **File:** `src/notifications/entities/notification-audience-setting.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `audience` | audience | text | no |  |  |  |
| `is_enabled` | isEnabled | boolean | no |  |  |  |
| `quiet_start` | quietStart | time without time zone | yes |  |  | Local wall-clock "HH:MM[:SS]"; may wrap midnight (22:00 → 08:00). |
| `quiet_end` | quietEnd | time without time zone | yes |  |  |  |
| `timezone` | timezone | text | yes |  |  | IANA zone for quiet hours; null = the location's timezone. |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_notification_audience_settings_org_audience` (organization_id, audience)

Constraints:

- CHECK `chk_notification_audience_settings_quiet`: `("quiet_start" IS NULL) = ("quiet_end" IS NULL)`
- CHECK `chk_notification_audience_settings_audience`: `"audience" IN ('patient', 'doctor', 'coordinator', 'lab')`

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="notification-events"></a>
#### `NotificationEvent` → `notification_events`

> Platform catalog of everything that can notify someone (lab ERD §7). Platform-level (no `organization_id`): seeded from code on boot, insert-if-missing, so later sprints add events by adding seed entries.

- **File:** `src/notifications/entities/notification-event.entity.ts`
- **PK:** `code` (text, no default — app supplies)
- **Tenant scope:** global — platform catalog
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `code` | code | text | no |  | PK | e.g. `order.submitted`, `item.ready`. |
| `name` | name | text | no |  |  |  |
| `description` | description | text | no |  |  |  |
| `audiences` | audiences | text[] | no |  |  |  |
| `is_mandatory_internal` | isMandatoryInternal | boolean | no | false |  | Internal audiences always get it in-app; clinics cannot switch it off. |
| `variables` | variables | text[] | no | '{}' |  | Placeholders the event supplies (besides the common ones). |
| `sort_order` | sortOrder | integer | no | '0' |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

<a id="notification-outbox"></a>
#### `NotificationOutbox` → `notification_outbox`

> One message to one recipient on one channel (lab ERD §7). Written in the same transaction as the change that caused it — skipped ones too, so the log says why a message never went — and sent by the worker only after commit. Never deleted; after insert only the worker touches it, and only the delive…

- **File:** `src/notifications/entities/notification-outbox.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | yes |  | L |  |
| `event_code` | eventCode | text | no |  | FK→`notification_events` |  |
| `audience` | audience | text | no |  |  |  |
| `recipient_type` | recipientType | text | no |  |  |  |
| `recipient_id` | recipientId | uuid | no |  | L |  |
| `channel` | channel | text | no |  |  |  |
| `entity_type` | entityType | text | yes |  |  | What caused it (an order, an item …), for "messages about this order". |
| `entity_id` | entityId | uuid | yes |  | L |  |
| `payload` | payload | jsonb | no |  |  |  |
| `status` | status | text | no |  |  |  |
| `scheduled_for` | scheduledFor | timestamp with time zone | no | now() |  | Not before this; also the worker's lease while a send is in flight. |
| `attempts` | attempts | integer | no | '0' |  |  |
| `provider_message_id` | providerMessageId | text | yes |  |  |  |
| `last_error` | lastError | text | yes |  |  |  |
| `sent_at` | sentAt | timestamp with time zone | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Indexes and unique constraints:

- INDEX `idx_notification_outbox_entity` (entity_type, entity_id)
- INDEX `idx_notification_outbox_org_created` (organization_id, created_at)
- INDEX `idx_notification_outbox_pending` (status, scheduled_for) WHERE "status" IN ('queued', 'held_quiet_hours')

Constraints:

- CHECK `chk_notification_outbox_channel`: `"channel" IN ('in_app', 'whatsapp', 'sms', 'email')`
- CHECK `chk_notification_outbox_audience`: `"audience" IN ('patient', 'doctor', 'coordinator', 'lab')`
- CHECK `chk_notification_outbox_status`: `"status" IN ('queued', 'held_quiet_hours', 'sent', 'delivered', 'failed', 'skipped_disabled', 'skipped_opt_out')`

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)
- (event_code) → `notification_events`(code) ON DELETE RESTRICT — `event` (many-to-one)

Logical references (no FK):

- `location_id` → locations — INFERRED (column name)
- `recipient_id` → polymorphic — discriminated by `recipient_type` — VERIFIED polymorphic (type + id pair, no FK possible)
- `entity_id` → polymorphic — discriminated by `entity_type` — VERIFIED polymorphic (type + id pair, no FK possible)

<a id="notification-rules"></a>
#### `NotificationRule` → `notification_rules`

> Per clinic: is this event sent to this audience on this channel? Rows are created lazily on first change; a missing row means `defaultRuleEnabled`.

- **File:** `src/notifications/entities/notification-rule.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `event_code` | eventCode | text | no |  | FK→`notification_events` |  |
| `audience` | audience | text | no |  |  |  |
| `channel` | channel | text | no |  |  |  |
| `is_enabled` | isEnabled | boolean | no |  |  |  |
| `template_id` | templateId | uuid | yes |  | FK→`notification_templates` |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_notification_rules_org_event_audience_channel` (organization_id, event_code, audience, channel)

Constraints:

- CHECK `chk_notification_rules_channel`: `"channel" IN ('in_app', 'whatsapp', 'sms', 'email')`
- CHECK `chk_notification_rules_audience`: `"audience" IN ('patient', 'doctor', 'coordinator', 'lab')`

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (event_code) → `notification_events`(code) ON DELETE RESTRICT — `event` (many-to-one)
- (template_id) → `notification_templates`(id) ON DELETE SET NULL — `template` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="notification-templates"></a>
#### `NotificationTemplate` → `notification_templates`

> Wording of one event on one channel in one language. `organization_id` null = platform default (seeded); a clinic's own row overrides it.

- **File:** `src/notifications/entities/notification-template.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | yes |  | FK→`organizations` |  |
| `event_code` | eventCode | text | no |  | FK→`notification_events` |  |
| `channel` | channel | text | no |  |  |  |
| `language` | language | text | no |  |  |  |
| `subject` | subject | text | yes |  |  | In-app title / email subject; unused by WhatsApp and SMS. |
| `body` | body | text | no |  |  | Text with `{placeholder}`s. |
| `variables` | variables | text[] | no | '{}' |  | Placeholders the subject + body use (computed on save). |
| `provider_template_ref` | providerTemplateRef | text | yes |  |  | WhatsApp: the provider-approved template id (business-initiated messages need one). |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_notification_templates_org` (organization_id, event_code, channel, language) WHERE "organization_id" IS NOT NULL
- UNIQUE INDEX `uq_notification_templates_platform` (event_code, channel, language) WHERE "organization_id" IS NULL

Constraints:

- CHECK `chk_notification_templates_language`: `"language" IN ('en', 'ur', 'roman_ur')`
- CHECK `chk_notification_templates_channel`: `"channel" IN ('in_app', 'whatsapp', 'sms', 'email')`

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE CASCADE — `organization` (many-to-one)
- (event_code) → `notification_events`(code) ON DELETE RESTRICT — `event` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="patient-comm-prefs"></a>
#### `PatientCommPref` → `patient_comm_prefs`

> A patient's messaging opt-outs and language (decision order step 4).

- **File:** `src/notifications/entities/patient-comm-pref.entity.ts`
- **PK:** `patient_id` (uuid, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `patient_id` | patientId | uuid | no |  | PK FK→`patients` |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `whatsapp_opt_out` | whatsappOptOut | boolean | no | false |  |  |
| `sms_opt_out` | smsOptOut | boolean | no | false |  |  |
| `email_opt_out` | emailOptOut | boolean | no | false |  |  |
| `preferred_language` | preferredLanguage | text | yes |  |  |  |
| `opted_out_at` | optedOutAt | timestamp with time zone | yes |  |  | Last time any opt-out was switched on. |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- INDEX `idx_patient_comm_prefs_org` (organization_id)

Constraints:

- CHECK `chk_patient_comm_prefs_language`: `"preferred_language" IS NULL OR "preferred_language" IN ('en', 'ur', 'roman_ur')`

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE CASCADE — `patient` (one-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="user-notifications"></a>
#### `UserNotification` → `user_notifications`

> A user's in-app copy of a sent `in_app` outbox row (the bell). One per outbox row (unique), so a re-delivered send never shows twice.

- **File:** `src/notifications/entities/user-notification.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `user_id` | userId | uuid | no |  | FK→`users` |  |
| `outbox_id` | outboxId | uuid | no |  | FK→`notification_outbox` UQ |  |
| `organization_id` | organizationId | uuid | no |  | L | The clinic it came from, so a multi-clinic user can filter. |
| `event_code` | eventCode | text | no |  |  |  |
| `title` | title | text | no |  |  |  |
| `body` | body | text | no |  |  |  |
| `link` | link | text | yes |  |  |  |
| `read_at` | readAt | timestamp with time zone | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `UQ_a46f7ae8e3849101d74f73e0c4a` (outbox_id)
- UNIQUE `REL_a46f7ae8e3849101d74f73e0c4` (outbox_id)
- INDEX `idx_user_notifications_unread` (user_id) WHERE "read_at" IS NULL
- INDEX `idx_user_notifications_user_created` (user_id, created_at)

Foreign keys (enforced):

- (user_id) → `users`(uuid) ON DELETE CASCADE — `user` (many-to-one)
- (outbox_id) → `notification_outbox`(id) ON DELETE RESTRICT — `outbox` (one-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

### Module `labs`

<a id="lab-clinic-links"></a>
#### `LabClinicLink` → `lab_clinic_links`

> A clinic organization working with a lab: its own status, payment terms and how much patient identity the lab may see. Tenant-owned — every read is scoped by `organization_id`. Status changes go through `LabLinksService` only and land in `status_history`.

- **File:** `src/labs/entities/lab-clinic-link.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `status` | status | enum(invited, active, suspended) | no | 'invited' |  |  |
| `payment_terms_days` | paymentTermsDays | integer | no | '30' |  |  |
| `patient_data_level` | patientDataLevel | enum(full_name, code_only) | no | 'full_name' |  |  |
| `activated_at` | activatedAt | timestamp with time zone | yes |  |  | First activation; kept when the link is later suspended and reactivated. |
| `notes` | notes | text | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_clinic_links_lab_org` (lab_id, organization_id)
- INDEX `idx_lab_clinic_links_org_status` (organization_id, status)

Constraints:

- CHECK `chk_lab_clinic_links_terms`: `"payment_terms_days" BETWEEN 0 AND 365`

Foreign keys (enforced):

- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-members"></a>
#### `LabMember` → `lab_members`

> A user who works at a lab. Lab-side access is resolved from these rows only — a lab user holds no clinic membership, so no clinic query can ever return their data (lab ERD §7).

- **File:** `src/labs/entities/lab-member.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** global — lab-side (scoped by lab_id)
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `user_id` | userId | uuid | no |  | FK→`users` |  |
| `role` | role | enum(lab_admin, lab_technician) | no |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_members_lab_user` (lab_id, user_id)
- INDEX `idx_lab_members_user` (user_id)

Foreign keys (enforced):

- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)
- (user_id) → `users`(uuid) ON DELETE RESTRICT — `user` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="labs"></a>
#### `Lab` → `labs`

> A dental lab — platform-level (no tenant column): one lab works with many clinics through `lab_clinic_links`, so it never needs a login per clinic. An internal lab belongs to one clinic organization (`owner_organization_id`).

- **File:** `src/labs/entities/lab.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** global — external labs are cross-tenant (internal labs carry owner_organization_id)
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `lab_type` | labType | enum(external, internal) | no |  |  |  |
| `owner_organization_id` | ownerOrganizationId | uuid | yes |  | FK→`organizations` |  |
| `name` | name | character varying(150) | no |  |  |  |
| `phone` | phone | character varying(20) | yes |  |  |  |
| `whatsapp_phone` | whatsappPhone | character varying(20) | yes |  |  |  |
| `email` | email | character varying(255) | yes |  |  |  |
| `city` | city | character varying(100) | yes |  |  |  |
| `address` | address | text | yes |  |  | Pickup / delivery address for couriers (not in the ERD; needed by shipments). |
| `status` | status | enum(active, suspended) | no | 'active' |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- INDEX `idx_labs_owner` (owner_organization_id)
- INDEX `idx_labs_status_name` (status, name)

Constraints:

- CHECK `chk_labs_owner`: `("lab_type" = 'internal') = ("owner_organization_id" IS NOT NULL)`

Foreign keys (enforced):

- (owner_organization_id) → `organizations`(id) ON DELETE RESTRICT — `ownerOrganization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `lab-access`

<a id="magic-links"></a>
#### `MagicLink` → `magic_links`

> A no-login link for one lab and one order (lab ERD §7 "Magic link security"). The token is never stored: only `token_hash` (sha256). The token itself is HMAC(server secret, `nonce`) — 32 random bytes of nonce, 32 bytes of token — so the outbox worker can put it into the message at send time without…

- **File:** `src/lab-access/entities/magic-link.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `token_hash` | tokenHash | character(64) | no |  | UQ | sha256 hex of the token. |
| `nonce` | nonce | character(64) | no |  |  | select: false; Random input of the token derivation (not the token). |
| `purpose` | purpose | enum(lab_view_order, lab_update_order, receive_shipment) | no |  |  |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `shipment_id` | shipmentId | uuid | yes |  | L | Shipment links (Sprint 8); no FK until that table exists here. |
| `recipient_phone` | recipientPhone | character varying(20) | yes |  |  |  |
| `delivery` | delivery | enum(notification, copy) | no |  |  |  |
| `expires_at` | expiresAt | timestamp with time zone | no |  |  |  |
| `max_uses` | maxUses | integer | yes |  |  | Null = unlimited until expiry. |
| `used_count` | usedCount | integer | no | '0' |  | Actions taken through the link (views are not counted). |
| `last_used_at` | lastUsedAt | timestamp with time zone | yes |  |  |  |
| `last_viewed_at` | lastViewedAt | timestamp with time zone | yes |  |  |  |
| `revoked_at` | revokedAt | timestamp with time zone | yes |  |  |  |
| `revoked_reason` | revokedReason | character varying(40) | yes |  |  | `order_closed`, `revoked_by_clinic`, `replaced`. |
| `revoked_by` | revokedBy | uuid | yes |  | L |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_magic_links_token_hash` (token_hash)
- INDEX `idx_magic_links_order` (order_id, created_at)

Constraints:

- CHECK `chk_magic_links_uses`: `"max_uses" IS NULL OR ("max_uses" > 0 AND "used_count" <= "max_uses")`

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)
- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)
- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)

Logical references (no FK):

- `shipment_id` → shipments — INFERRED (entity comment states target)
- `revoked_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `lab-catalog`

<a id="lab-service-options"></a>
#### `LabServiceOption` → `lab_service_options`

> A material or variant of a lab service (e.g. "Emax" on a crown), with the lab's extra cost per unit on top of the resolved service price.

- **File:** `src/lab-catalog/entities/lab-service-option.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** global — lab-side (scoped via lab_services.lab_id)
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `lab_service_id` | labServiceId | uuid | no |  | FK→`lab_services` |  |
| `option_type` | optionType | enum(material, variant) | no |  |  |  |
| `code` | code | character varying(50) | no |  |  |  |
| `name` | name | character varying(150) | no |  |  |  |
| `extra_cost_minor` | extraCostMinor | bigint | no | '0' |  |  |
| `sort_order` | sortOrder | integer | no | '0' |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_service_options_code` (lab_service_id, code)

Constraints:

- CHECK `chk_lab_service_options_cost`: `"extra_cost_minor" >= 0`

Foreign keys (enforced):

- (lab_service_id) → `lab_services`(id) ON DELETE RESTRICT — `labService` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-service-prices"></a>
#### `LabServicePrice` → `lab_service_prices`

> A lab's price for a service over [effective_from, effective_to] (inclusive; null `effective_to` = open-ended). `organization_id` null is the lab's list price; set, it is that clinic's negotiated price, which wins over the list price (lab ERD §4). Windows of one (service, clinic) never overlap — exc…

- **File:** `src/lab-catalog/entities/lab-service-price.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `lab_service_id` | labServiceId | uuid | no |  | FK→`lab_services` |  |
| `organization_id` | organizationId | uuid | yes |  | FK→`organizations` | Null = the lab's list price for every clinic without a negotiated one. |
| `unit_price_minor` | unitPriceMinor | bigint | no | '0' |  |  |
| `rush_surcharge_minor` | rushSurchargeMinor | bigint | no | '0' |  |  |
| `currency` | currency | character(3) | no | 'PKR' |  |  |
| `effective_from` | effectiveFrom | date | no |  |  | "YYYY-MM-DD". |
| `effective_to` | effectiveTo | date | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `voided_at` | voidedAt | timestamp with time zone | yes |  |  | Set only on prices that never took effect (entered by mistake). |
| `void_reason` | voidReason | text | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- INDEX `idx_lab_service_prices_lookup` (lab_service_id, organization_id, effective_from)

Constraints:

- CHECK `chk_lab_service_prices_dates`: `"effective_to" IS NULL OR "effective_to" >= "effective_from"`
- CHECK `chk_lab_service_prices_amounts`: `"unit_price_minor" >= 0 AND "rush_surcharge_minor" >= 0`
- EXCLUDE `excl_lab_service_prices_overlap`: `USING gist ("lab_service_id" WITH =, COALESCE("organization_id", '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange("effective_from", "effective_to", '[]') WITH &&) WHERE ("voided_at" IS NULL)`

Foreign keys (enforced):

- (lab_service_id) → `lab_services`(id) ON DELETE RESTRICT — `labService` (many-to-one)
- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-services"></a>
#### `LabService` → `lab_services`

> Something a lab makes (zirconia crown, PFM bridge unit …). Platform-level like the lab itself — no tenant column; clinics see it through their lab link. Points at the engine definitions an order line runs on: the form the doctor fills, the item workflow and the try-in stage template. Those are plat…

- **File:** `src/lab-catalog/entities/lab-service.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** global — lab-side (scoped by lab_id)
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `specialty_id` | specialtyId | uuid | no |  | FK→`specialties` |  |
| `category_id` | categoryId | uuid | no |  | FK→`service_categories` |  |
| `code` | code | character varying(50) | no |  |  | Upper-case, unique per lab: `ZR_CROWN`. |
| `name` | name | character varying(150) | no |  |  |  |
| `description` | description | text | yes |  |  |  |
| `unit_type` | unitType | enum(per_tooth, per_unit, per_arch, per_case) | no |  |  |  |
| `default_turnaround_days` | defaultTurnaroundDays | integer | no | '7' |  |  |
| `form_schema_id` | formSchemaId | uuid | yes |  | FK→`form_schemas` |  |
| `workflow_template_id` | workflowTemplateId | uuid | yes |  | FK→`workflow_templates` |  |
| `stage_template_id` | stageTemplateId | uuid | yes |  | FK→`stage_templates` |  |
| `is_active` | isActive | boolean | no | true |  | Archived services are hidden from new orders; old orders keep them. |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_services_lab_code` (lab_id, code)
- INDEX `idx_lab_services_category` (category_id)
- INDEX `idx_lab_services_lab_active` (lab_id, is_active, name)

Constraints:

- CHECK `chk_lab_services_turnaround`: `"default_turnaround_days" BETWEEN 0 AND 365`

Foreign keys (enforced):

- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)
- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)
- (category_id) → `service_categories`(id) ON DELETE RESTRICT — `category` (many-to-one)
- (form_schema_id) → `form_schemas`(id) ON DELETE RESTRICT — `formSchema` (many-to-one)
- (workflow_template_id) → `workflow_templates`(id) ON DELETE RESTRICT — `workflowTemplate` (many-to-one)
- (stage_template_id) → `stage_templates`(id) ON DELETE RESTRICT — `stageTemplate` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="order-templates"></a>
#### `OrderTemplate` → `order_templates`

> A saved order a doctor starts from ("my usual zirconia crown") so an order takes seconds (lab ERD §13 "Doctor speed"). `owner_user_id` null = shared with the whole clinic. The body references lab services and form answers; it is validated on save, and again at order submit against the form version…

- **File:** `src/lab-catalog/entities/order-template.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `owner_user_id` | ownerUserId | uuid | yes |  | L | Null = shared with every doctor of the clinic. |
| `specialty_id` | specialtyId | uuid | no |  | FK→`specialties` |  |
| `lab_id` | labId | uuid | yes |  | FK→`labs` | Null = the doctor picks the lab when ordering. |
| `name` | name | character varying(150) | no |  |  |  |
| `template_json` | templateJson | jsonb | no |  |  |  |
| `use_count` | useCount | integer | no | '0' |  |  |
| `last_used_at` | lastUsedAt | timestamp with time zone | yes |  |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- INDEX `idx_order_templates_org_owner` (organization_id, owner_user_id, is_active)

Constraints:

- CHECK `chk_order_templates_use_count`: `"use_count" >= 0`

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)
- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)
- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)

Logical references (no FK):

- `owner_user_id` → users — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="service-categories"></a>
#### `ServiceCategory` → `service_categories`

> Groups lab services within a specialty (CROWN, BRIDGE, DENTURE …). Platform-level: every lab files its services under the same categories, so clinics can compare labs like for like.

- **File:** `src/lab-catalog/entities/service-category.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** global — platform catalog (per specialty)
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `specialty_id` | specialtyId | uuid | no |  | FK→`specialties` |  |
| `code` | code | character varying(50) | no |  |  | Upper-case, stable: `CROWN`. |
| `name` | name | character varying(100) | no |  |  |  |
| `sort_order` | sortOrder | integer | no | '0' |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_service_categories_code` (specialty_id, code)
- INDEX `idx_service_categories_specialty` (specialty_id, is_active, sort_order)

Foreign keys (enforced):

- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="service-mappings"></a>
#### `ServiceMapping` → `service_mappings`

> Which lab service fulfils which of the clinic's treatments. The clinic treatment is the billing catalog's `services` row — the clinic's patient price list already lives there (Sprint 5 deviation, see hand-over); the column keeps the ERD name. A treatment may be made by several labs (one is the defa…

- **File:** `src/lab-catalog/entities/service-mapping.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `clinic_treatment_id` | clinicTreatmentId | uuid | no |  | FK→`services` | `services.id` — the clinic's billable treatment. |
| `lab_service_id` | labServiceId | uuid | no |  | FK→`lab_services` |  |
| `is_default` | isDefault | boolean | no | false |  |  |
| `is_active` | isActive | boolean | no | true |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_service_mappings_pair` (organization_id, clinic_treatment_id, lab_service_id)
- UNIQUE INDEX `uq_service_mappings_default` (organization_id, clinic_treatment_id) WHERE "is_active" AND "is_default"
- UNIQUE INDEX `uq_service_mappings_lab_service` (organization_id, lab_service_id) WHERE "is_active"

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)
- (clinic_treatment_id) → `services`(id) ON DELETE RESTRICT — `clinicTreatment` (many-to-one)
- (lab_service_id) → `lab_services`(id) ON DELETE RESTRICT — `labService` (many-to-one)

Logical references (no FK):

- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `lab-orders`

<a id="attachments"></a>
#### `Attachment` → `attachments`

> A file on an order or item (lab ERD §5a, §11): the bytes live in private storage, the row keeps the key, size, mime and sha256. Polymorphic, so the parent is checked in the app layer; the CHECK limits the entity types. Downloads are short-lived signed URLs; the lab sees `lab_shared` only. Never del…

- **File:** `src/lab-orders/entities/attachment.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `entity_type` | entityType | character varying(30) | no |  |  |  |
| `entity_id` | entityId | uuid | no |  | L |  |
| `order_id` | orderId | uuid | no |  | L | The order the file belongs to (also for item files) — for scoping. |
| `storage_key` | storageKey | text | no |  |  |  |
| `file_name` | fileName | character varying(255) | no |  |  |  |
| `mime_type` | mimeType | character varying(100) | no |  |  |  |
| `size_bytes` | sizeBytes | bigint | no |  |  |  |
| `sha256` | sha256 | character(64) | no |  |  |  |
| `visibility` | visibility | enum(internal, lab_shared, patient_shared) | no |  |  |  |
| `uploaded_side` | uploadedSide | enum(clinic, lab) | no |  |  |  |
| `uploaded_by` | uploadedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_attachments_entity` (entity_type, entity_id)

Constraints:

- CHECK `chk_attachments_size`: `"size_bytes" >= 0`
- CHECK `chk_attachments_entity_type`: `"entity_type" IN ('lab_order','lab_order_item')`

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `entity_id` → polymorphic — discriminated by `entity_type` — VERIFIED polymorphic (type + id pair, no FK possible)
- `order_id` → lab_orders — INFERRED (entity comment states target)
- `uploaded_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="dental-item-details"></a>
#### `DentalItemDetails` → `dental_item_details`

> Typed dental columns promoted from the form answers at submit (lab ERD §3 promotions) so reports read columns, not JSON. The only specialty-specific table the order code touches, and only through the form's `promotions` map.

- **File:** `src/lab-orders/entities/item-parts.entity.ts`
- **PK:** `item_id` (uuid, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `item_id` | itemId | uuid | no |  | PK FK→`lab_order_items` |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `shade_system` | shadeSystem | character varying(50) | yes |  |  |  |
| `shade` | shade | character varying(20) | yes |  |  |  |
| `material_code` | materialCode | character varying(50) | yes |  |  |  |
| `implant_system` | implantSystem | character varying(100) | yes |  |  |  |
| `implant_platform` | implantPlatform | character varying(100) | yes |  |  |  |
| `implant_diameter_mm` | implantDiameterMm | numeric(4,2) | yes |  |  |  |
| `margin_type` | marginType | character varying(50) | yes |  |  |  |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Foreign keys (enforced):

- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (one-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

<a id="item-form-responses"></a>
#### `ItemFormResponse` → `item_form_responses`

> The item's form answers against its pinned form version. Drafts store whatever was typed (`validated_at` null); submit validates and stores the normalised answers.

- **File:** `src/lab-orders/entities/item-parts.entity.ts`
- **PK:** `item_id` (uuid, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `item_id` | itemId | uuid | no |  | PK FK→`lab_order_items` |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `form_schema_version_id` | formSchemaVersionId | uuid | yes |  | FK→`form_schema_versions` |  |
| `data` | data | jsonb | no | '{}'::jsonb |  |  |
| `validated_at` | validatedAt | timestamp with time zone | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Foreign keys (enforced):

- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (one-to-one)
- (form_schema_version_id) → `form_schema_versions`(id) ON DELETE RESTRICT — `formSchemaVersion` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

<a id="item-teeth"></a>
#### `ItemTooth` → `item_teeth`

> One tooth of an item (lab ERD §5a): a 3-unit bridge is one item with three rows. Written at submit (and by revisions) from the item's `tooth_chart` answer — the form response stays the source of truth.

- **File:** `src/lab-orders/entities/item-parts.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `item_id` | itemId | uuid | no |  | FK→`lab_order_items` |  |
| `numbering_system` | numberingSystem | character varying(10) | no | 'FDI' |  |  |
| `tooth_code` | toothCode | character varying(5) | no |  |  |  |
| `dentition` | dentition | character varying(10) | no |  |  |  |
| `tooth_role` | toothRole | character varying(20) | yes |  |  |  |
| `surfaces` | surfaces | text[] | no | '{}' |  |  |

Indexes and unique constraints:

- UNIQUE `uq_item_teeth_tooth` (item_id, tooth_code)
- INDEX `idx_item_teeth_item` (item_id)

Constraints:

- CHECK `chk_item_teeth_numbering`: `"numbering_system" IN ('FDI','UNIVERSAL','PALMER')`

Foreign keys (enforced):

- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

<a id="lab-order-items"></a>
#### `LabOrderItem` → `lab_order_items`

> One piece of work (lab ERD §5a): a crown, a bridge, a denture … with its own price snapshot, form answers, teeth and status. The `*_snap` and `*_minor` columns are frozen once the order is submitted (inv. 3) — see `snapshot-freeze.ts`; only a revision or an approved charge request may change them.…

- **File:** `src/lab-orders/entities/lab-order-item.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `line_no` | lineNo | integer | no |  |  |  |
| `lab_service_id` | labServiceId | uuid | no |  | FK→`lab_services` |  |
| `clinic_treatment_id` | clinicTreatmentId | uuid | yes |  | L | Billing `services.id` the patient is charged as (see Sprint 5 deviation 1). |
| `option_ids` | optionIds | uuid[] | no | '{}' | L | Chosen lab options (ids) — the draft input; frozen as `options_snap`. |
| `rush` | rush | boolean | no | false |  |  |
| `quantity` | quantity | integer | no | '1' |  |  |
| `service_code_snap` | serviceCodeSnap | character varying(50) | yes |  |  |  |
| `service_name_snap` | serviceNameSnap | character varying(150) | yes |  |  |  |
| `unit_type` | unitType | enum(per_tooth, per_unit, per_arch, per_case) | yes |  |  |  |
| `options_snap` | optionsSnap | jsonb | yes |  |  |  |
| `lab_price_id` | labPriceId | uuid | yes |  | L | The `lab_service_prices` row the cost came from. |
| `currency` | currency | character(3) | no | 'PKR' |  |  |
| `lab_unit_cost_minor` | labUnitCostMinor | bigint | no | '0' |  |  |
| `lab_line_cost_minor` | labLineCostMinor | bigint | no | '0' |  |  |
| `patient_unit_price_minor` | patientUnitPriceMinor | bigint | no | '0' |  |  |
| `patient_line_price_minor` | patientLinePriceMinor | bigint | no | '0' |  |  |
| `priced_on` | pricedOn | date | yes |  |  |  |
| `form_schema_version_id` | formSchemaVersionId | uuid | yes |  | FK→`form_schema_versions` | Null when the service has no form. |
| `workflow_template_version_id` | workflowTemplateVersionId | uuid | no |  | FK→`workflow_template_versions` |  |
| `stage_template_id` | stageTemplateId | uuid | yes |  | L | Stage template of the service, copied for Sprint 8's `init_stages`. |
| `status_code` | statusCode | character varying(50) | yes |  |  | Null while the order is a draft; the item workflow's state after submit. |
| `current_stage_seq` | currentStageSeq | integer | yes |  |  |  |
| `remake_of_item_id` | remakeOfItemId | uuid | yes |  | FK→`lab_order_items` |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_order_items_line` (order_id, line_no)
- INDEX `idx_lab_order_items_remake` (remake_of_item_id)
- INDEX `idx_lab_order_items_org_status` (organization_id, status_code)
- INDEX `idx_lab_order_items_order` (order_id)

Constraints:

- CHECK `chk_lab_order_items_minor`: `"lab_unit_cost_minor" >= 0 AND "lab_line_cost_minor" >= 0 AND "patient_unit_price_minor" >= 0 AND "patient_line_price_minor" >= 0`
- CHECK `chk_lab_order_items_quantity`: `"quantity" > 0`

Foreign keys (enforced):

- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)
- (lab_service_id) → `lab_services`(id) ON DELETE RESTRICT — `labService` (many-to-one)
- (form_schema_version_id) → `form_schema_versions`(id) ON DELETE RESTRICT — `formSchemaVersion` (many-to-one)
- (workflow_template_version_id) → `workflow_template_versions`(id) ON DELETE RESTRICT — `workflowTemplateVersion` (many-to-one)
- (remake_of_item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `remakeOf` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `clinic_treatment_id` → services — INFERRED (entity comment states target)
- `option_ids` → lab_service_options (uuid[]) — INFERRED (column name)
- `lab_price_id` → lab_service_prices — INFERRED (entity comment states target)
- `stage_template_id` → stage_templates — INFERRED (entity comment states target)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-orders"></a>
#### `LabOrder` → `lab_orders`

> A lab case (lab ERD §5a): a container of items for one patient, one doctor and one lab. `status_code` follows the order workflow version pinned at create (never changes, inv. 7) and moves only through `WorkflowEngine.transition()` / derivation from the items (§9c). `order_no` is given at submit — d…

- **File:** `src/lab-orders/entities/lab-order.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | FK→`organizations` |  |
| `location_id` | locationId | uuid | no |  | FK→`locations` |  |
| `order_no` | orderNo | character varying(30) | yes |  |  | `LAB-0001`, from `number_sequences` at submit. |
| `specialty_id` | specialtyId | uuid | no |  | FK→`specialties` |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `doctor_id` | doctorId | uuid | yes |  | FK→`employees` |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `lab_clinic_link_id` | labClinicLinkId | uuid | no |  | FK→`lab_clinic_links` |  |
| `workflow_template_version_id` | workflowTemplateVersionId | uuid | no |  | FK→`workflow_template_versions` | Pinned at create; never changes (lab ERD inv. 7). |
| `status_code` | statusCode | character varying(50) | no |  |  |  |
| `priority` | priority | enum(normal, urgent) | no | 'normal' |  |  |
| `requested_on` | requestedOn | date | yes |  |  | The day the clinic wants the work back (optional). |
| `lab_expected_on` | labExpectedOn | date | yes |  |  | When the work is expected back. Estimated at submit (requested day, or submit day + the longest turnaround); the lab sets it on accept. |
| `appointment_id` | appointmentId | uuid | yes |  | L |  |
| `treatment_id` | treatmentId | uuid | yes |  | L | The patient's treatment record this case belongs to (optional). |
| `order_template_id` | orderTemplateId | uuid | yes |  | L | The order template the draft started from (counted at submit). |
| `notes` | notes | text | yes |  |  | Instructions for the whole case. |
| `current_revision_no` | currentRevisionNo | integer | no | '0' |  | 0 for drafts; 1 at submit; +1 per revision. |
| `submitted_at` | submittedAt | timestamp with time zone | yes |  |  |  |
| `accepted_at` | acceptedAt | timestamp with time zone | yes |  |  |  |
| `completed_at` | completedAt | timestamp with time zone | yes |  |  |  |
| `cancelled_at` | cancelledAt | timestamp with time zone | yes |  |  |  |
| `idempotency_key` | idempotencyKey | character varying(150) | yes |  |  | Idempotency-Key of the create request: the same key → the same draft. |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_orders_org_idempotency` (organization_id, idempotency_key)
- UNIQUE `uq_lab_orders_org_no` (organization_id, order_no)
- INDEX `idx_lab_orders_patient` (patient_id, created_at)
- INDEX `idx_lab_orders_lab_queue` (lab_id, status_code, submitted_at)
- INDEX `idx_lab_orders_org_status_due` (organization_id, status_code, lab_expected_on)

Foreign keys (enforced):

- (organization_id) → `organizations`(id) ON DELETE RESTRICT — `organization` (many-to-one)
- (location_id) → `locations`(id) ON DELETE RESTRICT — `location` (many-to-one)
- (specialty_id) → `specialties`(id) ON DELETE RESTRICT — `specialty` (many-to-one)
- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)
- (doctor_id) → `employees`(id) ON DELETE RESTRICT — `doctor` (many-to-one)
- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)
- (lab_clinic_link_id) → `lab_clinic_links`(id) ON DELETE RESTRICT — `labClinicLink` (many-to-one)
- (workflow_template_version_id) → `workflow_template_versions`(id) ON DELETE RESTRICT — `workflowTemplateVersion` (many-to-one)

Logical references (no FK):

- `appointment_id` → appointments — INFERRED (column name)
- `treatment_id` → treatments — INFERRED (entity comment states target)
- `order_template_id` → order_templates — INFERRED (entity comment states target)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="order-charge-requests"></a>
#### `OrderChargeRequest` → `order_charge_requests`

> An extra charge the lab asks for after submit (rush, material, shipping). Approved item-level charges are added to the item's lab line cost — the one way besides a revision that a frozen price changes.

- **File:** `src/lab-orders/entities/order-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `item_id` | itemId | uuid | yes |  | FK→`lab_order_items` |  |
| `kind` | kind | enum(rush, material, shipping, other) | no |  |  |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  |  |
| `currency` | currency | character(3) | no | 'PKR' |  |  |
| `reason` | reason | text | no |  |  |  |
| `status` | status | enum(pending, approved, rejected) | no | 'pending' |  |  |
| `requested_by` | requestedBy | uuid | yes |  | L |  |
| `decided_by` | decidedBy | uuid | yes |  | L |  |
| `decided_at` | decidedAt | timestamp with time zone | yes |  |  |  |
| `decision_note` | decisionNote | text | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- INDEX `idx_order_charge_requests_order` (order_id, status)

Constraints:

- CHECK `chk_order_charge_requests_amount`: `"amount_minor" > 0`

Foreign keys (enforced):

- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)
- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `requested_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `decided_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="order-messages"></a>
#### `OrderMessage` → `order_messages`

> Clinic ↔ lab conversation on an order (or one of its items).

- **File:** `src/lab-orders/entities/order-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `item_id` | itemId | uuid | yes |  | FK→`lab_order_items` |  |
| `author_user_id` | authorUserId | uuid | yes |  | L |  |
| `author_side` | authorSide | enum(clinic, lab) | no |  |  |  |
| `kind` | kind | enum(note, clarification_request, reply) | no |  |  |  |
| `body` | body | text | no |  |  |  |
| `resolved_at` | resolvedAt | timestamp with time zone | yes |  |  | A clarification request is resolved by the clinic's reply. |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_order_messages_order` (order_id, created_at)

Foreign keys (enforced):

- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)
- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `author_user_id` → users — INFERRED (column name)

<a id="order-revisions"></a>
#### `OrderRevision` → `order_revisions`

> What the lab was asked to make, as of one revision (lab ERD §13 "Revisions": a change after submit is a new version, never an overwrite). Rev 1 is written at submit. The lab acknowledges each.

- **File:** `src/lab-orders/entities/order-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `revision_no` | revisionNo | integer | no |  |  |  |
| `snapshot` | snapshot | jsonb | no |  |  |  |
| `reason` | reason | text | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `lab_acknowledged_at` | labAcknowledgedAt | timestamp with time zone | yes |  |  |  |
| `lab_acknowledged_by` | labAcknowledgedBy | uuid | yes |  | L |  |

Indexes and unique constraints:

- UNIQUE `uq_order_revisions_no` (order_id, revision_no)

Foreign keys (enforced):

- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `lab_acknowledged_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `lab-production`

<a id="item-assignments"></a>
#### `ItemAssignment` → `item_assignments`

> Which lab technician works on an item (lab ERD §5b). Reassigning closes the open row (`unassigned_at`) and adds a new one — one open per item.

- **File:** `src/lab-production/entities/production-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `assigned_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `lab_id` | labId | uuid | no |  | L |  |
| `item_id` | itemId | uuid | no |  | FK→`lab_order_items` |  |
| `lab_member_id` | labMemberId | uuid | no |  | FK→`lab_members` |  |
| `assigned_by` | assignedBy | uuid | yes |  | L |  |
| `assigned_at` | assignedAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `unassigned_at` | unassignedAt | timestamp with time zone | yes |  |  |  |
| `unassigned_by` | unassignedBy | uuid | yes |  | L |  |

Indexes and unique constraints:

- INDEX `idx_item_assignments_member` (lab_member_id, unassigned_at)
- UNIQUE INDEX `uq_item_assignments_open` (item_id) WHERE "unassigned_at" IS NULL

Foreign keys (enforced):

- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (many-to-one)
- (lab_member_id) → `lab_members`(id) ON DELETE RESTRICT — `labMember` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `lab_id` → labs — INFERRED (column name)
- `assigned_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `unassigned_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="item-warranties"></a>
#### `ItemWarranty` → `item_warranties`

> The warranty that starts when an item is delivered (lab ERD §14 step 8).

- **File:** `src/lab-production/entities/production-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `item_id` | itemId | uuid | no |  | FK→`lab_order_items` UQ |  |
| `starts_on` | startsOn | date | no |  |  |  |
| `ends_on` | endsOn | date | no |  |  |  |
| `terms` | terms | text | yes |  |  |  |
| `voided_at` | voidedAt | timestamp with time zone | yes |  |  |  |
| `void_reason` | voidReason | text | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `uq_item_warranties_item` (item_id)

Constraints:

- CHECK `chk_item_warranties_dates`: `"ends_on" >= "starts_on"`

Foreign keys (enforced):

- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

<a id="order-item-stages"></a>
#### `OrderItemStage` → `order_item_stages`

> One try-in round of one stage of an item (lab ERD §5b, §9b): "Metal try-in, round 2". Created from the item's stage template at lab accept (`init_stages`, round 1). A correction closes the round and adds a new row with `round_no + 1` — rounds are never overwritten. Inv. 9: one active stage per item…

- **File:** `src/lab-production/entities/order-item-stage.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** `is_active` flag

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `lab_id` | labId | uuid | no |  | L | The order's lab — lab portal reads filter on it. |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `item_id` | itemId | uuid | no |  | FK→`lab_order_items` |  |
| `stage_template_step_id` | stageTemplateStepId | uuid | yes |  | FK→`stage_template_steps` |  |
| `workflow_template_version_id` | workflowTemplateVersionId | uuid | no |  | FK→`workflow_template_versions` |  |
| `seq` | seq | integer | no |  |  |  |
| `round_no` | roundNo | integer | no | '1' |  |  |
| `code_snap` | codeSnap | character varying(50) | no |  |  |  |
| `name_snap` | nameSnap | character varying(100) | no |  |  |  |
| `is_final` | isFinal | boolean | no | false |  | The last stage: finished work (QC → ready → dispatch), not a try-in. |
| `requires_patient_visit` | requiresPatientVisit | boolean | no | true |  |  |
| `status_code` | statusCode | character varying(50) | no |  |  |  |
| `is_active` | isActive | boolean | no | false |  |  |
| `lab_expected_on` | labExpectedOn | date | yes |  |  |  |
| `appointment_id` | appointmentId | uuid | yes |  | L | The try-in appointment (optional link). |
| `outcome` | outcome | enum(approved, correction, rejected) | yes |  |  |  |
| `tryin_notes` | tryinNotes | text | yes |  |  |  |
| `correction_notes` | correctionNotes | text | yes |  |  |  |
| `decided_by` | decidedBy | uuid | yes |  | L |  |
| `decided_at` | decidedAt | timestamp with time zone | yes |  |  |  |
| `started_at` | startedAt | timestamp with time zone | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_order_item_stages_round` (item_id, seq, round_no)
- INDEX `idx_order_item_stages_lab_status` (lab_id, status_code)
- INDEX `idx_order_item_stages_order` (order_id)
- UNIQUE INDEX `uq_order_item_stages_one_active` (item_id) WHERE "is_active"

Constraints:

- CHECK `chk_order_item_stages_round`: `"round_no" > 0 AND "seq" > 0`

Foreign keys (enforced):

- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)
- (item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `item` (many-to-one)
- (stage_template_step_id) → `stage_template_steps`(id) ON DELETE RESTRICT — `stageTemplateStep` (many-to-one)
- (workflow_template_version_id) → `workflow_template_versions`(id) ON DELETE RESTRICT — `workflowTemplateVersion` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `lab_id` → labs — INFERRED (column name)
- `appointment_id` → appointments — INFERRED (column name)
- `decided_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="remake-requests"></a>
#### `RemakeRequest` → `remake_requests`

> A request to remake an item (lab ERD §5b, §10 "Remake decision"). Agreed → a new item in the same order (`remake_of_item_id`), priced by who is responsible (lab fault → lab cost and patient price both 0). An active warranty marks it a warranty claim automatically.

- **File:** `src/lab-production/entities/production-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `lab_id` | labId | uuid | no |  | L |  |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `original_item_id` | originalItemId | uuid | no |  | FK→`lab_order_items` |  |
| `new_item_id` | newItemId | uuid | yes |  | FK→`lab_order_items` UQ |  |
| `reason_code` | reasonCode | enum(shade, fit, fracture, design, damaged, other) | no |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `responsible_party` | responsibleParty | enum(lab, clinic, patient, undetermined) | no | 'undetermined' |  |  |
| `is_warranty_claim` | isWarrantyClaim | boolean | no | false |  |  |
| `warranty_id` | warrantyId | uuid | yes |  | L |  |
| `lab_charge_minor` | labChargeMinor | bigint | yes |  |  |  |
| `patient_charge_minor` | patientChargeMinor | bigint | yes |  |  |  |
| `status` | status | enum(requested, agreed, disputed, closed) | no | 'requested' |  |  |
| `requested_by` | requestedBy | uuid | yes |  | L |  |
| `decided_by` | decidedBy | uuid | yes |  | L |  |
| `decided_at` | decidedAt | timestamp with time zone | yes |  |  |  |
| `decision_note` | decisionNote | text | yes |  |  |  |
| `dispute_note` | disputeNote | text | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_remake_requests_new_item` (new_item_id)
- INDEX `idx_remake_requests_order` (order_id)
- INDEX `idx_remake_requests_lab_status` (lab_id, status)
- UNIQUE INDEX `uq_remake_requests_open` (original_item_id) WHERE "status" IN ('requested','disputed')

Constraints:

- CHECK `chk_remake_requests_minor`: `("lab_charge_minor" IS NULL OR "lab_charge_minor" >= 0) AND ("patient_charge_minor" IS NULL OR "patient_charge_minor" >= 0)`

Foreign keys (enforced):

- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)
- (original_item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `originalItem` (many-to-one)
- (new_item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `newItem` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `lab_id` → labs — INFERRED (column name)
- `warranty_id` → item_warranties — INFERRED (column name)
- `requested_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `decided_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="shipment-items"></a>
#### `ShipmentItem` → `shipment_items`

> One item in a shipment, with what was received and the incoming QC.

- **File:** `src/lab-production/entities/production-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `shipment_id` | shipmentId | uuid | no |  | FK→`shipments` |  |
| `order_id` | orderId | uuid | no |  | FK→`lab_orders` |  |
| `order_item_id` | orderItemId | uuid | no |  | FK→`lab_order_items` |  |
| `item_stage_id` | itemStageId | uuid | yes |  | FK→`order_item_stages` |  |
| `contents` | contents | enum(impression, model, framework, tryin, final, other) | no |  |  |  |
| `quantity` | quantity | integer | no | '1' |  |  |
| `received_qty` | receivedQty | integer | yes |  |  |  |
| `condition` | condition | enum(ok, damaged, missing) | yes |  |  |  |
| `qc_result` | qcResult | enum(pass, fail) | yes |  |  |  |
| `qc_notes` | qcNotes | text | yes |  |  |  |
| `received_at` | receivedAt | timestamp with time zone | yes |  |  |  |
| `received_by` | receivedBy | uuid | yes |  | L |  |

Indexes and unique constraints:

- UNIQUE `uq_shipment_items_item` (shipment_id, order_item_id)
- INDEX `idx_shipment_items_item` (order_item_id)

Constraints:

- CHECK `chk_shipment_items_received`: `"received_qty" IS NULL OR ("received_qty" >= 0 AND "received_qty" <= "quantity")`
- CHECK `chk_shipment_items_qty`: `"quantity" > 0`

Foreign keys (enforced):

- (shipment_id) → `shipments`(id) ON DELETE RESTRICT — `shipment` (many-to-one)
- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)
- (order_item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `orderItem` (many-to-one)
- (item_stage_id) → `order_item_stages`(id) ON DELETE RESTRICT — `itemStage` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `received_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="shipments"></a>
#### `Shipment` → `shipments`

> A parcel between a clinic and a lab, either direction (lab ERD §5b). One shipment carries items of several orders of one clinic and one lab. The `qr_token` is printed on the slip; scanning it opens the receive screen.

- **File:** `src/lab-production/entities/production-records.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `lab_id` | labId | uuid | no |  | L |  |
| `shipment_no` | shipmentNo | character varying(30) | no |  |  | `SHP-0001`, per clinic organization. |
| `direction` | direction | enum(to_lab, to_clinic) | no |  |  |  |
| `status` | status | enum(dispatched, partially_received, received, lost) | no | 'dispatched' |  |  |
| `courier_name` | courierName | character varying(100) | yes |  |  |  |
| `tracking_no` | trackingNo | character varying(100) | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `dispatched_at` | dispatchedAt | timestamp with time zone | no |  |  |  |
| `dispatched_by` | dispatchedBy | uuid | yes |  | L |  |
| `received_at` | receivedAt | timestamp with time zone | yes |  |  |  |
| `received_by` | receivedBy | uuid | yes |  | L |  |
| `lost_at` | lostAt | timestamp with time zone | yes |  |  |  |
| `lost_reason` | lostReason | text | yes |  |  |  |
| `qr_token` | qrToken | character varying(64) | no |  | UQ |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_shipments_qr_token` (qr_token)
- UNIQUE `uq_shipments_org_no` (organization_id, shipment_no)
- INDEX `idx_shipments_org_status` (organization_id, status, dispatched_at)
- INDEX `idx_shipments_lab_status` (lab_id, status, dispatched_at)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `lab_id` → labs — INFERRED (column name)
- `dispatched_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `received_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `lab-billing`

<a id="lab-billing-settings"></a>
#### `LabBillingSettings` → `lab_billing_settings`

> Per-clinic lab billing defaults (decision: tax in basis points, default 0 until the accountant confirms). Missing row = defaults.

- **File:** `src/lab-billing/entities/lab-credit.entity.ts`
- **PK:** `organization_id` (uuid, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `organization_id` | organizationId | uuid | no |  | PK |  |
| `tax_rate_bp` | taxRateBp | integer | no | '0' |  |  |
| `due_days` | dueDays | integer | no | '0' |  | Days from issue to due date. |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Constraints:

- CHECK `chk_lab_billing_settings`: `"tax_rate_bp" BETWEEN 0 AND 10000 AND "due_days" BETWEEN 0 AND 365`

Logical references (no FK):

- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-credit-notes"></a>
#### `LabCreditNote` → `lab_credit_notes`

> Corrects an issued invoice downwards (lab ERD §6a) — a cancelled or reduced job. It lowers the invoice's balance; whatever the patient had already paid above the new total is released from allocations back to advance (`released_minor`) and can then be refunded. Never deleted.

- **File:** `src/lab-billing/entities/lab-credit.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `credit_note_no` | creditNoteNo | character varying(30) | no |  |  |  |
| `invoice_id` | invoiceId | uuid | no |  | FK→`lab_invoices` |  |
| `patient_id` | patientId | uuid | no |  | L |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  |  |
| `reason` | reason | text | no |  |  |  |
| `status` | status | enum(issued, applied, refunded) | no |  |  |  |
| `released_minor` | releasedMinor | bigint | no | '0' |  | Paid money taken off the invoice into the patient's advance. |
| `refunded_minor` | refundedMinor | bigint | no | '0' |  | Σ refunds against this note (cached). |
| `created_by` | createdBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_credit_notes_org_no` (organization_id, credit_note_no)
- INDEX `idx_lab_credit_notes_invoice` (invoice_id)

Constraints:

- CHECK `chk_lab_credit_notes_amounts`: `"amount_minor" > 0 AND "released_minor" BETWEEN 0 AND "amount_minor" AND "refunded_minor" BETWEEN 0 AND "released_minor"`

Foreign keys (enforced):

- (invoice_id) → `lab_invoices`(id) ON DELETE RESTRICT — `invoice` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `patient_id` → patients — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-invoice-lines"></a>
#### `LabInvoiceLine` → `lab_invoice_lines`

> One billed thing. Money per line, half-up: net = qty × unit − discount; tax = net × tax_rate_bp / 10 000; total = net + tax. A lab order item (or charge request) sits on at most one non-void line (partial unique indexes), so it is never billed twice; voiding the invoice frees it.

- **File:** `src/lab-billing/entities/lab-invoice.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `invoice_id` | invoiceId | uuid | no |  | FK→`lab_invoices` |  |
| `line_no` | lineNo | integer | no |  |  |  |
| `line_kind` | lineKind | enum(lab_item, lab_charge, manual) | no |  |  |  |
| `lab_order_item_id` | labOrderItemId | uuid | yes |  | FK→`lab_order_items` |  |
| `order_charge_request_id` | orderChargeRequestId | uuid | yes |  | FK→`order_charge_requests` |  |
| `clinic_treatment_id` | clinicTreatmentId | uuid | yes |  | L | Billing `services.id` (from the item's frozen mapping). |
| `doctor_id` | doctorId | uuid | yes |  | L | The doctor credited for the work (employee) — commission input. |
| `performing_assignment_id` | performingAssignmentId | uuid | yes |  | L | Commission snapshot taken at issue (like billing v2's charges): the doctor's assignment at the invoice's location, the plan in force that d… |
| `commission_plan_id` | commissionPlanId | uuid | yes |  | L |  |
| `commission_rate_bps` | commissionRateBps | integer | yes |  |  |  |
| `commission_fixed_minor` | commissionFixedMinor | bigint | yes |  |  |  |
| `description` | description | character varying(200) | no |  |  |  |
| `quantity` | quantity | integer | no | '1' |  |  |
| `unit_price_minor` | unitPriceMinor | bigint | no | '0' |  |  |
| `discount_minor` | discountMinor | bigint | no | '0' |  |  |
| `tax_rate_bp` | taxRateBp | integer | no | '0' |  |  |
| `tax_minor` | taxMinor | bigint | no | '0' |  |  |
| `line_total_minor` | lineTotalMinor | bigint | no | '0' |  |  |
| `is_void` | isVoid | boolean | no | false |  | Copied from the invoice on void, for the partial unique indexes. |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_invoice_lines_no` (invoice_id, line_no)
- UNIQUE INDEX `uq_lab_invoice_lines_charge` (order_charge_request_id) WHERE "order_charge_request_id" IS NOT NULL AND NOT "is_void"
- UNIQUE INDEX `uq_lab_invoice_lines_item` (lab_order_item_id) WHERE "lab_order_item_id" IS NOT NULL AND NOT "is_void"

Constraints:

- CHECK `chk_lab_invoice_lines_math`: `"quantity" > 0 AND "unit_price_minor" >= 0 AND "discount_minor" >= 0 AND "discount_minor" <= "quantity" * "unit_price_minor" AND "tax_rate_bp" BETWEEN 0 AND 10000 AND "tax_minor" >= 0 AND "line_total_minor" = "quantity" * "unit_price_minor" - "discount_minor" + "tax_minor"`

Foreign keys (enforced):

- (invoice_id) → `lab_invoices`(id) ON DELETE RESTRICT — `invoice` (many-to-one)
- (lab_order_item_id) → `lab_order_items`(id) ON DELETE RESTRICT — `labOrderItem` (many-to-one)
- (order_charge_request_id) → `order_charge_requests`(id) ON DELETE RESTRICT — `orderChargeRequest` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `clinic_treatment_id` → services — INFERRED (entity comment states target)
- `doctor_id` → employees — INFERRED (entity comment states target)
- `performing_assignment_id` → employee_org_location_assignments — INFERRED (entity comment states target)
- `commission_plan_id` → compensation_plans — INFERRED (column name)

<a id="lab-invoices"></a>
#### `LabInvoice` → `lab_invoices`

> A patient invoice for lab work (lab ERD §6a). A `draft` is an estimate (no number, editable, owes nothing); issuing numbers it and freezes the lines. The cached money columns and `status` are written only by `LabBillingTotals` (billing v2 pattern 6.12): recomputed from source rows, never incremente…

- **File:** `src/lab-billing/entities/lab-invoice.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `invoice_no` | invoiceNo | character varying(30) | yes |  |  | Null while a draft (estimate). |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `order_id` | orderId | uuid | yes |  | FK→`lab_orders` |  |
| `status` | status | enum(draft, issued, partially_paid, paid, void) | no | 'draft' |  |  |
| `issued_on` | issuedOn | date | yes |  |  |  |
| `due_on` | dueOn | date | yes |  |  |  |
| `currency` | currency | character(3) | no | 'PKR' |  |  |
| `subtotal_minor` | subtotalMinor | bigint | no | '0' |  |  |
| `discount_minor` | discountMinor | bigint | no | '0' |  |  |
| `tax_minor` | taxMinor | bigint | no | '0' |  |  |
| `total_minor` | totalMinor | bigint | no | '0' |  |  |
| `credited_minor` | creditedMinor | bigint | no | '0' |  | Σ credit notes (cached). |
| `paid_minor` | paidMinor | bigint | no | '0' |  | Σ active allocations (cached). |
| `balance_minor` | balanceMinor | bigint | no | '0' |  |  |
| `notes` | notes | text | yes |  |  |  |
| `issued_by` | issuedBy | uuid | yes |  | L |  |
| `issued_at` | issuedAt | timestamp with time zone | yes |  |  |  |
| `void_reason` | voidReason | text | yes |  |  |  |
| `voided_by` | voidedBy | uuid | yes |  | L |  |
| `voided_at` | voidedAt | timestamp with time zone | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `updated_by` | updatedBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_invoices_org_no` (organization_id, invoice_no)
- INDEX `idx_lab_invoices_status` (organization_id, status)
- INDEX `idx_lab_invoices_order` (order_id)
- INDEX `idx_lab_invoices_patient` (organization_id, patient_id)

Constraints:

- CHECK `chk_lab_invoices_math`: `"total_minor" = "subtotal_minor" - "discount_minor" + "tax_minor" AND "balance_minor" >= 0 AND "paid_minor" >= 0 AND "credited_minor" >= 0`

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)
- (order_id) → `lab_orders`(id) ON DELETE RESTRICT — `order` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `issued_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `voided_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `updated_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-payment-allocations"></a>
#### `LabPaymentAllocation` → `lab_payment_allocations`

> "X of payment P settles invoice I". Positive, and never deleted: a reversal or a credit note stops it counting by setting `reversed_at` (lab ERD §10). Inv. 5: Σ active allocations of a payment ≤ its amount.

- **File:** `src/lab-billing/entities/lab-payment.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `payment_id` | paymentId | uuid | no |  | FK→`lab_payments` |  |
| `invoice_id` | invoiceId | uuid | no |  | FK→`lab_invoices` |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  |  |
| `created_by` | createdBy | uuid | no |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `reversed_at` | reversedAt | timestamp with time zone | yes |  |  |  |
| `reversed_by` | reversedBy | uuid | yes |  | L |  |
| `release_reason` | releaseReason | enum(payment_reversed, credit_note) | yes |  |  |  |

Indexes and unique constraints:

- INDEX `idx_lab_payment_allocations_invoice` (invoice_id)
- INDEX `idx_lab_payment_allocations_payment` (payment_id)

Constraints:

- CHECK `chk_lab_payment_allocations_amount`: `"amount_minor" > 0`

Foreign keys (enforced):

- (payment_id) → `lab_payments`(id) ON DELETE RESTRICT — `payment` (many-to-one)
- (invoice_id) → `lab_invoices`(id) ON DELETE RESTRICT — `invoice` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `reversed_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-payments"></a>
#### `LabPayment` → `lab_payments`

> Money received from a patient for lab work (lab ERD §6a). Belongs to the patient, not an invoice (billing v2 D6): the part not allocated or refunded is the patient's advance. Immutable except the cached `allocated_minor` / `refunded_minor` and `status`. A wrong payment is never deleted: it is rever…

- **File:** `src/lab-billing/entities/lab-payment.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `receipt_no` | receiptNo | character varying(30) | no |  |  |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  | Negative on a reversal row. |
| `currency` | currency | character(3) | no | 'PKR' |  |  |
| `method` | method | enum(cash, card, bank_transfer, wallet) | no |  |  |  |
| `reference` | reference | character varying(80) | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `received_at` | receivedAt | timestamp with time zone | no |  |  |  |
| `received_on` | receivedOn | date | no |  |  | Location-local day of `received_at` (reports, cash close). |
| `received_by` | receivedBy | uuid | no |  | L |  |
| `status` | status | enum(posted, reversed) | no | 'posted' |  |  |
| `reversal_of_id` | reversalOfId | uuid | yes |  | FK→`lab_payments` UQ |  |
| `reason` | reason | text | yes |  |  | On the reversal row: why. |
| `allocated_minor` | allocatedMinor | bigint | no | '0' |  | Σ active allocations (cached). |
| `refunded_minor` | refundedMinor | bigint | no | '0' |  | Σ refund sources (cached). |
| `idempotency_key` | idempotencyKey | character varying(150) | no |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_payments_reversal_of` (reversal_of_id)
- UNIQUE `uq_lab_payments_org_idempotency` (organization_id, idempotency_key)
- UNIQUE `uq_lab_payments_org_receipt` (organization_id, receipt_no)
- INDEX `idx_lab_payments_received` (organization_id, received_on)
- INDEX `idx_lab_payments_patient` (organization_id, patient_id)

Constraints:

- CHECK `chk_lab_payments_amounts`: `"amount_minor" <> 0 AND "allocated_minor" >= 0 AND "refunded_minor" >= 0 AND ("reversal_of_id" IS NULL) = ("amount_minor" > 0) AND "allocated_minor" + "refunded_minor" <= GREATEST("amount_minor", 0)`

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)
- (reversal_of_id) → `lab_payments`(id) ON DELETE RESTRICT — `reversalOf` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `received_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="lab-refund-sources"></a>
#### `LabRefundSource` → `lab_refund_sources`

> Which payment's advance funded a refund. Σ = refund amount.

- **File:** `src/lab-billing/entities/lab-credit.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** none
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `refund_id` | refundId | uuid | no |  | FK→`lab_refunds` |  |
| `payment_id` | paymentId | uuid | no |  | FK→`lab_payments` |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  |  |

Indexes and unique constraints:

- INDEX `idx_lab_refund_sources_payment` (payment_id)
- INDEX `idx_lab_refund_sources_refund` (refund_id)

Constraints:

- CHECK `chk_lab_refund_sources_amount`: `"amount_minor" > 0`

Foreign keys (enforced):

- (refund_id) → `lab_refunds`(id) ON DELETE RESTRICT — `refund` (many-to-one)
- (payment_id) → `lab_payments`(id) ON DELETE RESTRICT — `payment` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)

<a id="lab-refunds"></a>
#### `LabRefund` → `lab_refunds`

> Money paid back to a patient, always out of advance (billing v2 D14): `lab_refund_sources` say which payments funded it. `credit_note_id` set = the payout of a credit note (lab ERD §6a "paid out as").

- **File:** `src/lab-billing/entities/lab-credit.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `refund_no` | refundNo | character varying(30) | no |  |  |  |
| `patient_id` | patientId | uuid | no |  | FK→`patients` |  |
| `credit_note_id` | creditNoteId | uuid | yes |  | FK→`lab_credit_notes` |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  |  |
| `method` | method | enum(cash, card, bank_transfer, wallet) | no |  |  |  |
| `reference` | reference | character varying(80) | yes |  |  |  |
| `reason` | reason | text | no |  |  |  |
| `refunded_at` | refundedAt | timestamp with time zone | no |  |  |  |
| `refunded_by` | refundedBy | uuid | no |  | L |  |
| `idempotency_key` | idempotencyKey | character varying(150) | no |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- UNIQUE `uq_lab_refunds_org_idempotency` (organization_id, idempotency_key)
- UNIQUE `uq_lab_refunds_org_no` (organization_id, refund_no)
- INDEX `idx_lab_refunds_credit_note` (credit_note_id)
- INDEX `idx_lab_refunds_patient` (organization_id, patient_id)

Constraints:

- CHECK `chk_lab_refunds_amount`: `"amount_minor" > 0`

Foreign keys (enforced):

- (patient_id) → `patients`(id) ON DELETE RESTRICT — `patient` (many-to-one)
- (credit_note_id) → `lab_credit_notes`(id) ON DELETE RESTRICT — `creditNote` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `refunded_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `lab-payables`

<a id="lab-statement-lines"></a>
#### `LabStatementLine` → `lab_statement_lines`

> One line of the statement, or a `missing_in_statement` row the reconciliation added for a bill the lab left out.

- **File:** `src/lab-payables/entities/lab-statement.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `statement_id` | statementId | uuid | no |  | FK→`lab_statements` |  |
| `lab_reference` | labReference | character varying(60) | yes |  |  | Order no, bill no or the lab's invoice no; null on system rows. |
| `line_date` | lineDate | date | yes |  |  |  |
| `description` | description | character varying(300) | yes |  |  |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  | The lab's amount; 0 on `missing_in_statement` rows. |
| `system_amount_minor` | systemAmountMinor | bigint | yes |  |  | What the clinic's bills say for the same reference. |
| `matched_bill_line_id` | matchedBillLineId | uuid | yes |  | L |  |
| `matched_bill_id` | matchedBillId | uuid | yes |  | L |  |
| `match_status` | matchStatus | enum(matched, amount_mismatch, missing_in_system, missing_in_statement) | no |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_lab_statement_lines_statement` (statement_id)

Foreign keys (enforced):

- (statement_id) → `lab_statements`(id) ON DELETE RESTRICT — `statement` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `matched_bill_line_id` → vendor_bill_lines — INFERRED (column name)
- `matched_bill_id` → vendor_bills — INFERRED (column name)

<a id="lab-statements"></a>
#### `LabStatement` → `lab_statements`

> A lab's monthly statement (lab ERD §6b), entered by the clinic and reconciled against the bills of the period.

- **File:** `src/lab-payables/entities/lab-statement.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `period_start` | periodStart | date | no |  |  |  |
| `period_end` | periodEnd | date | no |  |  |  |
| `statement_ref` | statementRef | character varying(60) | yes |  |  |  |
| `total_minor` | totalMinor | bigint | no | '0' |  | What the lab says is owed for the period. |
| `attachment_id` | attachmentId | uuid | yes |  | L | No storage for statement files yet (attachments are order-scoped). |
| `status` | status | enum(uploaded, reconciling, reconciled, disputed) | no | 'uploaded' |  |  |
| `notes` | notes | text | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- INDEX `idx_lab_statements_lab` (organization_id, lab_id, period_start)

Foreign keys (enforced):

- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `attachment_id` → attachments — INFERRED (entity comment states target)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="vendor-bill-lines"></a>
#### `VendorBillLine` → `vendor_bill_lines`

> One cost on a bill: an item's lab cost, an approved extra charge or a remake. Lines of a draft follow the order (re-synced); after approval they are frozen with the bill.

- **File:** `src/lab-payables/entities/vendor-bill.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `vendor_bill_id` | vendorBillId | uuid | no |  | FK→`vendor_bills` |  |
| `line_kind` | lineKind | enum(service, rush, shipping, material, remake, other) | no |  |  |  |
| `lab_order_id` | labOrderId | uuid | yes |  | L |  |
| `order_item_id` | orderItemId | uuid | yes |  | L |  |
| `charge_request_id` | chargeRequestId | uuid | yes |  | L |  |
| `remake_request_id` | remakeRequestId | uuid | yes |  | L |  |
| `description` | description | character varying(300) | no |  |  |  |
| `quantity` | quantity | integer | no | '1' |  |  |
| `unit_cost_minor` | unitCostMinor | bigint | no | '0' |  |  |
| `line_total_minor` | lineTotalMinor | bigint | no | '0' |  |  |
| `is_manual` | isManual | boolean | no | false |  | Added by hand on the draft (not synced from the order). |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_vendor_bill_lines_charge` (charge_request_id)
- INDEX `idx_vendor_bill_lines_item` (order_item_id)
- INDEX `idx_vendor_bill_lines_bill` (vendor_bill_id)

Constraints:

- CHECK `chk_vendor_bill_lines_minor`: `"quantity" > 0 AND "unit_cost_minor" >= 0 AND "line_total_minor" >= 0`

Foreign keys (enforced):

- (vendor_bill_id) → `vendor_bills`(id) ON DELETE RESTRICT — `bill` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `lab_order_id` → lab_orders — INFERRED (column name)
- `order_item_id` → lab_order_items — INFERRED (column name)
- `charge_request_id` → order_charge_requests — INFERRED (column name)
- `remake_request_id` → remake_requests — INFERRED (column name)

<a id="vendor-bills"></a>
#### `VendorBill` → `vendor_bills`

> What the clinic owes a lab (lab ERD §6b). One draft per lab order is made at lab accept from the items' frozen lab costs; nothing reaches the ledger until approval (Lab Cost / Lab Payable). `paid_minor` / `balance_minor` are cached and recomputed in every allocation's transaction. Never deleted: a…

- **File:** `src/lab-payables/entities/vendor-bill.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create), `updated_at` (update) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `lab_order_id` | labOrderId | uuid | yes |  | L | The order the draft was made for; null for a manual bill. |
| `bill_no` | billNo | character varying(30) | no |  |  |  |
| `vendor_invoice_no` | vendorInvoiceNo | character varying(60) | yes |  |  | The lab's own invoice number, entered at approval. |
| `statement_id` | statementId | uuid | yes |  | L |  |
| `status` | status | enum(draft, approved, partially_paid, paid, void) | no | 'draft' |  |  |
| `bill_date` | billDate | date | no |  |  |  |
| `due_on` | dueOn | date | yes |  |  |  |
| `subtotal_minor` | subtotalMinor | bigint | no | '0' |  |  |
| `tax_bp` | taxBp | integer | no | '0' |  | Basis points of the subtotal, default 0 until the accountant sets the rate. |
| `tax_minor` | taxMinor | bigint | no | '0' |  |  |
| `total_minor` | totalMinor | bigint | no | '0' |  |  |
| `paid_minor` | paidMinor | bigint | no | '0' |  |  |
| `balance_minor` | balanceMinor | bigint | no | '0' |  |  |
| `currency` | currency | character(3) | no | 'PKR' |  |  |
| `notes` | notes | text | yes |  |  |  |
| `approved_by` | approvedBy | uuid | yes |  | L |  |
| `approved_at` | approvedAt | timestamp with time zone | yes |  |  |  |
| `journal_id` | journalId | uuid | yes |  | L | The Lab Cost / Lab Payable journal. |
| `voided_by` | voidedBy | uuid | yes |  | L |  |
| `voided_at` | voidedAt | timestamp with time zone | yes |  |  |  |
| `void_reason` | voidReason | text | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- UNIQUE INDEX `uq_vendor_bills_order_draft` (lab_order_id) WHERE "status" = 'draft' AND "lab_order_id" IS NOT NULL
- INDEX `idx_vendor_bills_order` (lab_order_id)
- INDEX `idx_vendor_bills_lab_status_due` (lab_id, status, due_on)
- UNIQUE INDEX `uq_vendor_bills_vendor_invoice` (organization_id, lab_id, vendor_invoice_no) WHERE "vendor_invoice_no" IS NOT NULL AND "status" <> 'void'
- UNIQUE INDEX `uq_vendor_bills_no` (organization_id, bill_no)

Constraints:

- CHECK `chk_vendor_bills_minor`: `"subtotal_minor" >= 0 AND "tax_minor" >= 0 AND "total_minor" = "subtotal_minor" + "tax_minor" AND "paid_minor" >= 0 AND "balance_minor" >= 0`

Foreign keys (enforced):

- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `lab_order_id` → lab_orders — INFERRED (column name)
- `statement_id` → lab_statements — INFERRED (column name)
- `approved_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `journal_id` → ledger_journals — INFERRED (entity comment states target)
- `voided_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="vendor-payment-allocations"></a>
#### `VendorPaymentAllocation` → `vendor_payment_allocations`

> Part of a payment settling one bill. Reversed, never deleted.

- **File:** `src/lab-payables/entities/vendor-payment.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `vendor_payment_id` | vendorPaymentId | uuid | no |  | FK→`vendor_payments` |  |
| `vendor_bill_id` | vendorBillId | uuid | no |  | FK→`vendor_bills` |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  |  |
| `reversed_at` | reversedAt | timestamp with time zone | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_vendor_payment_allocations_bill` (vendor_bill_id)
- INDEX `idx_vendor_payment_allocations_payment` (vendor_payment_id)

Constraints:

- CHECK `chk_vendor_payment_allocations_minor`: `"amount_minor" > 0`

Foreign keys (enforced):

- (vendor_payment_id) → `vendor_payments`(id) ON DELETE RESTRICT — `payment` (many-to-one)
- (vendor_bill_id) → `vendor_bills`(id) ON DELETE RESTRICT — `bill` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

<a id="vendor-payments"></a>
#### `VendorPayment` → `vendor_payments`

> Money the clinic paid a lab (lab ERD §6b). Split over approved bills by allocations; an unallocated rest is an advance to the lab that a later allocation can use. Never deleted: a mistake is reversed.

- **File:** `src/lab-payables/entities/vendor-payment.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✔
- **Timestamps:** `created_at` (create) · **optimistic version:** `version`
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `location_id` | locationId | uuid | no |  | L |  |
| `lab_id` | labId | uuid | no |  | FK→`labs` |  |
| `payment_no` | paymentNo | character varying(30) | no |  |  |  |
| `amount_minor` | amountMinor | bigint | no | '0' |  |  |
| `allocated_minor` | allocatedMinor | bigint | no | '0' |  | Cached Σ active allocations. |
| `method` | method | enum(cash, bank_transfer, cheque, other) | no |  |  |  |
| `reference` | reference | character varying(100) | yes |  |  |  |
| `paid_on` | paidOn | date | no |  |  |  |
| `paid_at` | paidAt | timestamp with time zone | no |  |  |  |
| `status` | status | enum(posted, reversed) | no | 'posted' |  |  |
| `reversed_at` | reversedAt | timestamp with time zone | yes |  |  | Set on a reversed payment: the mirror journal carries the reversal. |
| `reversed_by` | reversedBy | uuid | yes |  | L |  |
| `reversal_reason` | reversalReason | text | yes |  |  |  |
| `notes` | notes | text | yes |  |  |  |
| `created_by` | createdBy | uuid | yes |  | L |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |
| `version` | version | integer | no | '1' |  | @VersionColumn |

Indexes and unique constraints:

- INDEX `idx_vendor_payments_lab` (organization_id, lab_id, paid_at)
- UNIQUE INDEX `uq_vendor_payments_no` (organization_id, payment_no)

Constraints:

- CHECK `chk_vendor_payments_minor`: `"amount_minor" > 0 AND "allocated_minor" >= 0 AND "allocated_minor" <= "amount_minor"`

Foreign keys (enforced):

- (lab_id) → `labs`(id) ON DELETE RESTRICT — `lab` (many-to-one)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `location_id` → locations — INFERRED (column name)
- `reversed_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)
- `created_by` → users (actor) — INFERRED (actor column; writers pass `actor.userId` / `user.uuid`)

### Module `common`

<a id="audit-logs"></a>
#### `AuditLog` → `audit_logs`

> Generic append-only audit trail (lab ERD §7): who changed what, with the before/after of only the fields that changed. UPDATE and DELETE are rejected by a trigger (migration LabManagementFoundation). `organization_id` is null for platform-level records (e.g. labs edited by a super admin) — every te…

- **File:** `src/common/audit/entities/audit-log.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | yes |  | L |  |
| `entity_type` | entityType | character varying(50) | no |  |  |  |
| `entity_id` | entityId | uuid | no |  | L |  |
| `subject_id` | subjectId | uuid | yes |  | L | The record this row's history belongs to, when that is not the entity itself (a patient's vitals → the patient). Merged histories read by i… |
| `action` | action | enum(create, update, void, delete, export, view_sensitive) | no |  |  |  |
| `changes` | changes | jsonb | yes |  |  | `{ before, after }` — changed fields only; `before` is null on create. |
| `actor_user_id` | actorUserId | uuid | yes |  | L |  |
| `actor_side` | actorSide | enum(clinic, lab, platform, system) | no |  |  |  |
| `ip` | ip | inet | yes |  |  |  |
| `request_id` | requestId | character varying(100) | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_audit_logs_subject` (subject_id, created_at)
- INDEX `idx_audit_logs_org_created` (organization_id, created_at)
- INDEX `idx_audit_logs_entity` (entity_type, entity_id, created_at)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `entity_id` → polymorphic — discriminated by `entity_type` — VERIFIED polymorphic (type + id pair, no FK possible)
- `subject_id` → polymorphic — the record whose history this row joins (comment) — VERIFIED polymorphic (type + id pair, no FK possible)
- `actor_user_id` → users — INFERRED (column name)

<a id="number-sequences"></a>
#### `NumberSequence` → `number_sequences`

> Gapless per-organization counters for human numbers (LAB-0001, SHP-0001 …). Only touched through `NumberSequenceService.next()` inside a transaction.

- **File:** `src/common/sequences/number-sequence.entity.ts`
- **PK:** `organization_id` + `sequence_key` (uuid, no default — app supplies; character varying, no default — app supplies)
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `updated_at` (update)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `organization_id` | organizationId | uuid | no |  | PK |  |
| `sequence_key` | sequenceKey | character varying(30) | no |  | PK |  |
| `prefix` | prefix | character varying(10) | no |  |  |  |
| `next_value` | nextValue | bigint | no | '1' |  |  |
| `updated_at` | updatedAt | timestamp with time zone | no | now() |  | @UpdateDateColumn |

Constraints:

- CHECK `chk_number_sequences_next_value`: `"next_value" > 0`

<a id="status-history"></a>
#### `StatusHistory` → `status_history`

> Append-only log of every status change (lab ERD §7): from → to, the action, who did it, from which side and through which channel. States are free text because workflow states are data (engine templates), not enums. UPDATE and DELETE are rejected by a trigger.

- **File:** `src/common/audit/entities/status-history.entity.ts`
- **PK:** `id` (uuid, default uuid_generate_v7())
- **Tenant scope:** organization ✔ · location ✘
- **Timestamps:** `created_at` (create)
- **Soft delete:** none

| Column | Property | Type | Null | Default | Keys | Notes |
|---|---|---|---|---|---|---|
| `id` | id | uuid | no | uuid_generate_v7() | PK |  |
| `organization_id` | organizationId | uuid | no |  | L |  |
| `entity_type` | entityType | character varying(50) | no |  |  |  |
| `entity_id` | entityId | uuid | no |  | L |  |
| `subject_id` | subjectId | uuid | yes |  | L | Same as `audit_logs.subject_id`: the record whose history this joins. |
| `from_state` | fromState | character varying(50) | yes |  |  | Null for the creating transition. |
| `to_state` | toState | character varying(50) | no |  |  |  |
| `action_code` | actionCode | character varying(50) | no |  |  |  |
| `actor_user_id` | actorUserId | uuid | yes |  | L |  |
| `actor_side` | actorSide | enum(clinic, lab, platform, system) | no |  |  |  |
| `via` | via | enum(app, portal, magic_link, proxy, qr) | no | 'app' |  |  |
| `on_behalf_of_lab_id` | onBehalfOfLabId | uuid | yes |  | L | Set when clinic staff updated on the lab's behalf (`via = proxy`). |
| `reason` | reason | text | yes |  |  |  |
| `metadata` | metadata | jsonb | yes |  |  |  |
| `created_at` | createdAt | timestamp with time zone | no | now() |  | @CreateDateColumn |

Indexes and unique constraints:

- INDEX `idx_status_history_subject` (subject_id, created_at)
- INDEX `idx_status_history_entity` (entity_type, entity_id, created_at)

Logical references (no FK):

- `organization_id` → organizations — INFERRED (column name)
- `entity_id` → polymorphic — discriminated by `entity_type` — VERIFIED polymorphic (type + id pair, no FK possible)
- `subject_id` → polymorphic — the record whose history this row joins (comment) — VERIFIED polymorphic (type + id pair, no FK possible)
- `actor_user_id` → users — INFERRED (column name)
- `on_behalf_of_lab_id` → labs — INFERRED (entity comment states target)

## 6. Relationships — FK-enforced

Every FK the entities generate. Cardinality reads parent → child. **Child end** = how many parents a child row must have:
`1 (mandatory)` when the FK column is NOT NULL, `0..1 (optional)` when nullable. A unique FK (or `@OneToOne`) makes the parent end `0..1`.
`ON DELETE` is the generated action (`NO ACTION` = TypeORM default, behaves like RESTRICT at statement end). All VERIFIED.

| # | Child table.column | Parent table | Cardinality | Child end | ON DELETE | Child property → inverse property |
|---|---|---|---|---|---|---|
| 1 | `oauth_providers`.`user_id` | `users` | User 1 — 0..* OAuthProvider | 1 (mandatory) | CASCADE | `user` (many-to-one) |
| 2 | `security_logs`.`user_id` | `users` | User 1 — 0..* SecurityLog | 0..1 (optional) | SET NULL | `user` (many-to-one) |
| 3 | `user_sessions`.`user_id` | `users` | User 1 — 0..* UserSession | 1 (mandatory) | CASCADE | `user` (many-to-one) |
| 4 | `organization_ownership`.`organization_id` | `organizations` | Organization 1 — 0..* OrganizationOwnership | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 5 | `organization_ownership`.`user_id` | `users` | User 1 — 0..* OrganizationOwnership | 1 (mandatory) | CASCADE | `user` (many-to-one) |
| 6 | `organization_settings`.`organization_id` | `organizations` | Organization 1 — 0..1 OrganizationSettings | 1 (mandatory) | CASCADE | `organization` (one-to-one) |
| 7 | `location_settings`.`location_id` | `locations` | Location 1 — 0..1 LocationSettings | 1 (mandatory) | CASCADE | `location` (one-to-one) |
| 8 | `location_settings`.`organization_id` | `organizations` | Organization 1 — 0..* LocationSettings | 0..1 (optional) | CASCADE | `organization` (many-to-one) |
| 9 | `locations`.`organization_id` | `organizations` | Organization 1 — 0..* Location | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 10 | `nav_layouts`.`organization_id` | `organizations` | Organization 1 — 0..* NavLayout | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 11 | `nav_layouts`.`role_id` | `employment_roles` | EmploymentRole 1 — 0..* NavLayout | 0..1 (optional) | CASCADE | `role` (many-to-one) |
| 12 | `location_feature_overrides`.`location_id` | `locations` | Location 1 — 0..* LocationFeatureOverride | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 13 | `org_feature_flags`.`organization_id` | `organizations` | Organization 1 — 0..* OrgFeatureFlag | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 14 | `subscription_payments`.`organization_id` | `organizations` | Organization 1 — 0..* SubscriptionPayment | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 15 | `doctor_availability_overrides`.`employee_id` | `employees` | Employee 1 — 0..* DoctorAvailabilityOverride | 1 (mandatory) | CASCADE | `employee` (many-to-one) |
| 16 | `doctor_availability_overrides`.`location_id` | `locations` | Location 1 — 0..* DoctorAvailabilityOverride | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 17 | `doctor_availability_overrides`.`organization_id` | `organizations` | Organization 1 — 0..* DoctorAvailabilityOverride | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 18 | `employee_leaves`.`employee_id` | `employees` | Employee 1 — 0..* EmployeeLeave | 1 (mandatory) | CASCADE | `employee` (many-to-one) |
| 19 | `employee_leaves`.`location_id` | `locations` | Location 1 — 0..* EmployeeLeave | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 20 | `employee_leaves`.`organization_id` | `organizations` | Organization 1 — 0..* EmployeeLeave | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 21 | `employee_org_location_assignments`.`employee_id` | `employees` | Employee 1 — 0..* EmployeeOrgLocationAssignment | 1 (mandatory) | CASCADE | `employee` (many-to-one) → `assignments` |
| 22 | `employee_org_location_assignments`.`employment_role_id` | `employment_roles` | EmploymentRole 1 — 0..* EmployeeOrgLocationAssignment | 0..1 (optional) | SET NULL | `employmentRole` (many-to-one) |
| 23 | `employee_org_location_assignments`.`location_id` | `locations` | Location 1 — 0..* EmployeeOrgLocationAssignment | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 24 | `employee_org_location_assignments`.`organization_id` | `organizations` | Organization 1 — 0..* EmployeeOrgLocationAssignment | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 25 | `employee_org_location_assignments`.`user_id` | `users` | User 1 — 0..* EmployeeOrgLocationAssignment | 0..1 (optional) | SET NULL | `user` (many-to-one) |
| 26 | `employee_schedules`.`employee_id` | `employees` | Employee 1 — 0..* EmployeeSchedule | 1 (mandatory) | CASCADE | `employee` (many-to-one) → `schedules` |
| 27 | `employee_schedules`.`location_id` | `locations` | Location 1 — 0..* EmployeeSchedule | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 28 | `employee_schedules`.`organization_id` | `organizations` | Organization 1 — 0..* EmployeeSchedule | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 29 | `employment_roles`.`organization_id` | `organizations` | Organization 1 — 0..* EmploymentRole | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 30 | `payroll_records`.`employee_id` | `employees` | Employee 1 — 0..* PayrollRecord | 1 (mandatory) | CASCADE | `employee` (many-to-one) |
| 31 | `payroll_records`.`location_id` | `locations` | Location 1 — 0..* PayrollRecord | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 32 | `payroll_records`.`organization_id` | `organizations` | Organization 1 — 0..* PayrollRecord | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 33 | `patient_communications`.`location_id` | `locations` | Location 1 — 0..* PatientCommunication | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 34 | `patient_communications`.`organization_id` | `organizations` | Organization 1 — 0..* PatientCommunication | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 35 | `patient_communications`.`patient_id` | `patients` | Patient 1 — 0..* PatientCommunication | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `communications` |
| 36 | `patient_consents`.`location_id` | `locations` | Location 1 — 0..* PatientConsent | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 37 | `patient_consents`.`organization_id` | `organizations` | Organization 1 — 0..* PatientConsent | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 38 | `patient_consents`.`patient_id` | `patients` | Patient 1 — 0..* PatientConsent | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `consents` |
| 39 | `patient_dental_info`.`organization_id` | `organizations` | Organization 1 — 0..* PatientDentalInfo | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 40 | `patient_dental_info`.`patient_id` | `patients` | Patient 1 — 0..1 PatientDentalInfo | 1 (mandatory) | CASCADE | `patient` (one-to-one) → `dentalInfo` |
| 41 | `patient_documents`.`location_id` | `locations` | Location 1 — 0..* PatientDocument | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 42 | `patient_documents`.`organization_id` | `organizations` | Organization 1 — 0..* PatientDocument | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 43 | `patient_documents`.`patient_id` | `patients` | Patient 1 — 0..* PatientDocument | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `documents` |
| 44 | `patient_feedback`.`location_id` | `locations` | Location 1 — 0..* PatientFeedback | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 45 | `patient_feedback`.`organization_id` | `organizations` | Organization 1 — 0..* PatientFeedback | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 46 | `patient_feedback`.`patient_id` | `patients` | Patient 1 — 0..* PatientFeedback | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `feedback` |
| 47 | `patient_insurance`.`organization_id` | `organizations` | Organization 1 — 0..* PatientInsurance | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 48 | `patient_insurance`.`patient_id` | `patients` | Patient 1 — 0..* PatientInsurance | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `insurance` |
| 49 | `patient_prescriptions`.`location_id` | `locations` | Location 1 — 0..* PatientPrescription | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 50 | `patient_prescriptions`.`organization_id` | `organizations` | Organization 1 — 0..* PatientPrescription | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 51 | `patient_prescriptions`.`patient_id` | `patients` | Patient 1 — 0..* PatientPrescription | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `prescriptions` |
| 52 | `patient_recalls`.`location_id` | `locations` | Location 1 — 0..* PatientRecall | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 53 | `patient_recalls`.`organization_id` | `organizations` | Organization 1 — 0..* PatientRecall | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 54 | `patient_recalls`.`patient_id` | `patients` | Patient 1 — 0..* PatientRecall | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `recalls` |
| 55 | `patient_referrals`.`organization_id` | `organizations` | Organization 1 — 0..* PatientReferral | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 56 | `patient_referrals`.`referred_patient_id` | `patients` | Patient 1 — 0..* PatientReferral | 0..1 (optional) | SET NULL | `referredPatient` (many-to-one) |
| 57 | `patient_referrals`.`referring_patient_id` | `patients` | Patient 1 — 0..* PatientReferral | 1 (mandatory) | CASCADE | `referringPatient` (many-to-one) → `referralsMade` |
| 58 | `patient_teeth_chart`.`location_id` | `locations` | Location 1 — 0..* PatientTeethChart | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 59 | `patient_teeth_chart`.`organization_id` | `organizations` | Organization 1 — 0..* PatientTeethChart | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 60 | `patient_teeth_chart`.`patient_id` | `patients` | Patient 1 — 0..* PatientTeethChart | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `teethCharts` |
| 61 | `patient_treatment_plans`.`location_id` | `locations` | Location 1 — 0..* PatientTreatmentPlan | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 62 | `patient_treatment_plans`.`organization_id` | `organizations` | Organization 1 — 0..* PatientTreatmentPlan | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 63 | `patient_treatment_plans`.`patient_id` | `patients` | Patient 1 — 0..* PatientTreatmentPlan | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `treatmentPlans` |
| 64 | `patient_visits`.`location_id` | `locations` | Location 1 — 0..* PatientVisit | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 65 | `patient_visits`.`organization_id` | `organizations` | Organization 1 — 0..* PatientVisit | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 66 | `patient_visits`.`patient_id` | `patients` | Patient 1 — 0..* PatientVisit | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `visits` |
| 67 | `patient_vitals`.`location_id` | `locations` | Location 1 — 0..* PatientVitals | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 68 | `patient_vitals`.`organization_id` | `organizations` | Organization 1 — 0..* PatientVitals | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 69 | `patient_vitals`.`patient_id` | `patients` | Patient 1 — 0..* PatientVitals | 1 (mandatory) | CASCADE | `patient` (many-to-one) → `vitals` |
| 70 | `patients`.`organization_id` | `organizations` | Organization 1 — 0..* Patient | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 71 | `patients`.`primary_location_id` | `locations` | Location 1 — 0..* Patient | 0..1 (optional) | SET NULL | `primaryLocation` (many-to-one) |
| 72 | `treatment_plan_items`.`plan_id` | `patient_treatment_plans` | PatientTreatmentPlan 1 — 0..* TreatmentPlanItem | 1 (mandatory) | CASCADE | `plan` (many-to-one) → `items` |
| 73 | `appointments`.`doctor_id` | `employees` | Employee 1 — 0..* Appointment | 1 (mandatory) | RESTRICT | `doctor` (many-to-one) |
| 74 | `appointments`.`location_id` | `locations` | Location 1 — 0..* Appointment | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 75 | `appointments`.`organization_id` | `organizations` | Organization 1 — 0..* Appointment | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 76 | `appointments`.`patient_id` | `patients` | Patient 1 — 0..* Appointment | 1 (mandatory) | CASCADE | `patient` (many-to-one) |
| 77 | `queue_entries`.`appointment_id` | `appointments` | Appointment 1 — 0..* QueueEntry | 0..1 (optional) | CASCADE | `appointment` (many-to-one) |
| 78 | `queue_entries`.`patient_id` | `patients` | Patient 1 — 0..* QueueEntry | 1 (mandatory) | CASCADE | `patient` (many-to-one) |
| 79 | `queue_entries`.`queue_session_id` | `queue_sessions` | QueueSession 1 — 0..* QueueEntry | 1 (mandatory) | RESTRICT | `session` (many-to-one) → `entries` |
| 80 | `queue_sessions`.`doctor_id` | `employees` | Employee 1 — 0..* QueueSession | 1 (mandatory) | RESTRICT | `doctor` (many-to-one) |
| 81 | `patient_encounters`.`appointment_id` | `appointments` | Appointment 1 — 0..* PatientEncounter | 0..1 (optional) | SET NULL | `appointment` (many-to-one) |
| 82 | `patient_encounters`.`location_id` | `locations` | Location 1 — 0..* PatientEncounter | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 83 | `patient_encounters`.`organization_id` | `organizations` | Organization 1 — 0..* PatientEncounter | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 84 | `patient_encounters`.`patient_id` | `patients` | Patient 1 — 0..* PatientEncounter | 1 (mandatory) | CASCADE | `patient` (many-to-one) |
| 85 | `patient_encounters`.`queue_entry_id` | `queue_entries` | QueueEntry 1 — 0..1 PatientEncounter | 1 (mandatory) | CASCADE | `queueEntry` (many-to-one) |
| 86 | `treatments`.`encounter_id` | `patient_encounters` | PatientEncounter 1 — 0..* Treatment | 0..1 (optional) | SET NULL | `encounter` (many-to-one) → `treatments` |
| 87 | `treatments`.`location_id` | `locations` | Location 1 — 0..* Treatment | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 88 | `treatments`.`organization_id` | `organizations` | Organization 1 — 0..* Treatment | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 89 | `treatments`.`patient_id` | `patients` | Patient 1 — 0..* Treatment | 1 (mandatory) | CASCADE | `patient` (many-to-one) |
| 90 | `treatments`.`plan_template_id` | `plan_templates` | PlanTemplate 1 — 0..* Treatment | 0..1 (optional) | SET NULL | `planTemplate` (many-to-one) |
| 91 | `doctor_signatures`.`organization_id` | `organizations` | Organization 1 — 0..* DoctorSignature | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 92 | `medicine_directory`.`organization_id` | `organizations` | Organization 1 — 0..* MedicineDirectory | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 93 | `prescription_history`.`prescription_id` | `prescriptions` | Prescription 1 — 0..* PrescriptionHistory | 1 (mandatory) | CASCADE | `prescription` (many-to-one) |
| 94 | `prescription_medicines`.`medicine_directory_id` | `medicine_directory` | MedicineDirectory 1 — 0..* PrescriptionMedicine | 0..1 (optional) | SET NULL | `medicineDirectory` (many-to-one) |
| 95 | `prescription_medicines`.`prescription_id` | `prescriptions` | Prescription 1 — 0..* PrescriptionMedicine | 1 (mandatory) | CASCADE | `prescription` (many-to-one) → `medicines` |
| 96 | `prescription_templates`.`location_id` | `locations` | Location 1 — 0..* PrescriptionTemplate | 0..1 (optional) | CASCADE | `location` (many-to-one) |
| 97 | `prescription_templates`.`organization_id` | `organizations` | Organization 1 — 0..* PrescriptionTemplate | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 98 | `prescriptions`.`appointment_id` | `appointments` | Appointment 1 — 0..* Prescription | 0..1 (optional) | SET NULL | `appointment` (many-to-one) |
| 99 | `prescriptions`.`doctor_id` | `employees` | Employee 1 — 0..* Prescription | 0..1 (optional) | SET NULL | `doctor` (many-to-one) |
| 100 | `prescriptions`.`encounter_id` | `patient_encounters` | PatientEncounter 1 — 0..* Prescription | 0..1 (optional) | SET NULL | `encounter` (many-to-one) |
| 101 | `prescriptions`.`location_id` | `locations` | Location 1 — 0..* Prescription | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 102 | `prescriptions`.`organization_id` | `organizations` | Organization 1 — 0..* Prescription | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 103 | `prescriptions`.`patient_id` | `patients` | Patient 1 — 0..* Prescription | 1 (mandatory) | CASCADE | `patient` (many-to-one) |
| 104 | `prescriptions`.`prescription_template_id` | `prescription_templates` | PrescriptionTemplate 1 — 0..* Prescription | 0..1 (optional) | SET NULL | `prescriptionTemplate` (many-to-one) |
| 105 | `prescriptions`.`treatment_plan_template_id` | `treatment_plan_templates` | TreatmentPlanTemplate 1 — 0..* Prescription | 0..1 (optional) | SET NULL | `treatmentPlanTemplate` (many-to-one) |
| 106 | `treatment_plan_template_medicines`.`medicine_directory_id` | `medicine_directory` | MedicineDirectory 1 — 0..* TreatmentPlanTemplateMedicine | 0..1 (optional) | SET NULL | `medicineDirectory` (many-to-one) |
| 107 | `treatment_plan_template_medicines`.`template_id` | `treatment_plan_templates` | TreatmentPlanTemplate 1 — 0..* TreatmentPlanTemplateMedicine | 1 (mandatory) | CASCADE | `template` (many-to-one) → `medicines` |
| 108 | `treatment_plan_templates`.`organization_id` | `organizations` | Organization 1 — 0..* TreatmentPlanTemplate | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 109 | `form_schema_versions`.`form_schema_id` | `form_schemas` | FormSchema 1 — 0..* FormSchemaVersion | 1 (mandatory) | RESTRICT | `formSchema` (many-to-one) |
| 110 | `form_schemas`.`organization_id` | `organizations` | Organization 1 — 0..* FormSchema | 0..1 (optional) | RESTRICT | `organization` (many-to-one) |
| 111 | `form_schemas`.`specialty_id` | `specialties` | Specialty 1 — 0..* FormSchema | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 112 | `organization_specialties`.`organization_id` | `organizations` | Organization 1 — 0..* OrganizationSpecialty | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 113 | `organization_specialties`.`specialty_id` | `specialties` | Specialty 1 — 0..* OrganizationSpecialty | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 114 | `stage_template_steps`.`stage_template_id` | `stage_templates` | StageTemplate 1 — 0..* StageTemplateStep | 1 (mandatory) | CASCADE | `stageTemplate` (many-to-one) |
| 115 | `stage_templates`.`organization_id` | `organizations` | Organization 1 — 0..* StageTemplate | 0..1 (optional) | RESTRICT | `organization` (many-to-one) |
| 116 | `stage_templates`.`specialty_id` | `specialties` | Specialty 1 — 0..* StageTemplate | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 117 | `transition_effects`.`effect_code` | `workflow_effects` | WorkflowEffect 1 — 0..* TransitionEffect | 1 (mandatory) | RESTRICT | `effect` (many-to-one) |
| 118 | `transition_effects`.`transition_id` | `workflow_transitions` | WorkflowTransition 1 — 0..* TransitionEffect | 1 (mandatory) | RESTRICT | `transition` (many-to-one) |
| 119 | `workflow_states`.`template_version_id` | `workflow_template_versions` | WorkflowTemplateVersion 1 — 0..* WorkflowState | 1 (mandatory) | RESTRICT | `templateVersion` (many-to-one) |
| 120 | `workflow_template_versions`.`workflow_template_id` | `workflow_templates` | WorkflowTemplate 1 — 0..* WorkflowTemplateVersion | 1 (mandatory) | RESTRICT | `workflowTemplate` (many-to-one) |
| 121 | `workflow_templates`.`organization_id` | `organizations` | Organization 1 — 0..* WorkflowTemplate | 0..1 (optional) | RESTRICT | `organization` (many-to-one) |
| 122 | `workflow_templates`.`specialty_id` | `specialties` | Specialty 1 — 0..* WorkflowTemplate | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 123 | `workflow_transitions`.`from_state_id` | `workflow_states` | WorkflowState 1 — 0..* WorkflowTransition | 1 (mandatory) | RESTRICT | `fromState` (many-to-one) |
| 124 | `workflow_transitions`.`template_version_id` | `workflow_template_versions` | WorkflowTemplateVersion 1 — 0..* WorkflowTransition | 1 (mandatory) | RESTRICT | `templateVersion` (many-to-one) |
| 125 | `workflow_transitions`.`to_state_id` | `workflow_states` | WorkflowState 1 — 0..* WorkflowTransition | 1 (mandatory) | RESTRICT | `toState` (many-to-one) |
| 126 | `cash_close_lines`.`cash_close_id` | `cash_closes` | CashClose 1 — 0..* CashCloseLine | 1 (mandatory) | RESTRICT | `cashClose` (many-to-one) → `lines` |
| 127 | `charges`.`commission_plan_id` | `compensation_plans` | CompensationPlan 1 — 0..* Charge | 0..1 (optional) | RESTRICT | `commissionPlan` (many-to-one) |
| 128 | `charges`.`doctor_id` | `employees` | Employee 1 — 0..* Charge | 0..1 (optional) | RESTRICT | `doctor` (many-to-one) |
| 129 | `charges`.`invoice_id` | `invoices` | Invoice 1 — 0..* Charge | 0..1 (optional) | RESTRICT | `invoice` (many-to-one) → `charges` |
| 130 | `charges`.`patient_id` | `patients` | Patient 1 — 0..* Charge | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 131 | `charges`.`performing_assignment_id` | `employee_org_location_assignments` | EmployeeOrgLocationAssignment 1 — 0..* Charge | 0..1 (optional) | RESTRICT | `performingAssignment` (many-to-one) |
| 132 | `commission_entries`.`assignment_id` | `employee_org_location_assignments` | EmployeeOrgLocationAssignment 1 — 0..* CommissionEntry | 1 (mandatory) | RESTRICT | `assignment` (many-to-one) |
| 133 | `commission_entries`.`charge_id` | `charges` | Charge 1 — 0..* CommissionEntry | 0..1 (optional) | RESTRICT | `charge` (many-to-one) |
| 134 | `commission_entries`.`lab_invoice_line_id` | `lab_invoice_lines` | LabInvoiceLine 1 — 0..* CommissionEntry | 0..1 (optional) | RESTRICT | `labInvoiceLine` (many-to-one) |
| 135 | `commission_entries`.`settlement_id` | `commission_settlements` | CommissionSettlement 1 — 0..* CommissionEntry | 0..1 (optional) | RESTRICT | `settlement` (many-to-one) |
| 136 | `commission_rules`.`plan_id` | `compensation_plans` | CompensationPlan 1 — 0..* CommissionRule | 1 (mandatory) | CASCADE | `plan` (many-to-one) → `rules` |
| 137 | `commission_rules`.`service_id` | `services` | CatalogService 1 — 0..* CommissionRule | 0..1 (optional) | CASCADE | `service` (many-to-one) |
| 138 | `commission_settlements`.`assignment_id` | `employee_org_location_assignments` | EmployeeOrgLocationAssignment 1 — 0..* CommissionSettlement | 1 (mandatory) | RESTRICT | `assignment` (many-to-one) |
| 139 | `commission_settlements`.`payroll_record_id` | `payroll_records` | PayrollRecord 1 — 0..1 CommissionSettlement | 0..1 (optional) | RESTRICT | `payrollRecord` (one-to-one) |
| 140 | `compensation_plans`.`assignment_id` | `employee_org_location_assignments` | EmployeeOrgLocationAssignment 1 — 0..* CompensationPlan | 1 (mandatory) | CASCADE | `assignment` (many-to-one) |
| 141 | `credit_packages`.`organization_id` | `organizations` | Organization 1 — 0..* CreditPackage | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 142 | `expenses`.`location_id` | `locations` | Location 1 — 0..* Expense | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 143 | `expenses`.`organization_id` | `organizations` | Organization 1 — 0..* Expense | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 144 | `expenses`.`recorded_by` | `employees` | Employee 1 — 0..* Expense | 0..1 (optional) | SET NULL | `recorder` (many-to-one) |
| 145 | `invoices`.`patient_id` | `patients` | Patient 1 — 0..* Invoice | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 146 | `ledger_journal_lines`.`journal_id` | `ledger_journals` | LedgerJournal 1 — 0..* LedgerJournalLine | 1 (mandatory) | RESTRICT | `journal` (many-to-one) → `lines` |
| 147 | `patient_credits`.`credit_package_id` | `credit_packages` | CreditPackage 1 — 0..* PatientCredit | 0..1 (optional) | SET NULL | `creditPackage` (many-to-one) |
| 148 | `patient_credits`.`organization_id` | `organizations` | Organization 1 — 0..* PatientCredit | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 149 | `patient_credits`.`patient_id` | `patients` | Patient 1 — 0..* PatientCredit | 1 (mandatory) | CASCADE | `patient` (many-to-one) |
| 150 | `patient_credits`.`purchased_by` | `employees` | Employee 1 — 0..* PatientCredit | 0..1 (optional) | SET NULL | `purchaser` (many-to-one) |
| 151 | `payment_allocations`.`charge_id` | `charges` | Charge 1 — 0..* PaymentAllocation | 1 (mandatory) | RESTRICT | `charge` (many-to-one) |
| 152 | `payment_allocations`.`payment_id` | `payments` | Payment 1 — 0..* PaymentAllocation | 1 (mandatory) | RESTRICT | `payment` (many-to-one) |
| 153 | `payments`.`patient_id` | `patients` | Patient 1 — 0..* Payment | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 154 | `payments`.`payment_account_id` | `payment_accounts` | PaymentAccount 1 — 0..* Payment | 1 (mandatory) | RESTRICT | `paymentAccount` (many-to-one) |
| 155 | `refund_sources`.`payment_id` | `payments` | Payment 1 — 0..* RefundSource | 1 (mandatory) | RESTRICT | `payment` (many-to-one) |
| 156 | `refund_sources`.`refund_id` | `refunds` | Refund 1 — 0..* RefundSource | 1 (mandatory) | RESTRICT | `refund` (many-to-one) → `sources` |
| 157 | `refunds`.`patient_id` | `patients` | Patient 1 — 0..* Refund | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 158 | `service_prices`.`doctor_id` | `employees` | Employee 1 — 0..* ServicePrice | 0..1 (optional) | RESTRICT | `doctor` (many-to-one) |
| 159 | `service_prices`.`service_id` | `services` | CatalogService 1 — 0..* ServicePrice | 1 (mandatory) | RESTRICT | `service` (many-to-one) → `prices` |
| 160 | `consumption_template_items`.`inventoryItemId` | `inventory_items` | InventoryItem 1 — 0..* ConsumptionTemplateItem | 1 (mandatory) | NO ACTION | `inventoryItem` (many-to-one) |
| 161 | `consumption_template_items`.`templateId` | `consumption_templates` | ConsumptionTemplate 1 — 0..* ConsumptionTemplateItem | 1 (mandatory) | CASCADE | `template` (many-to-one) → `items` |
| 162 | `consumption_templates`.`organizationId` | `organizations` | Organization 1 — 0..* ConsumptionTemplate | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 163 | `inventory`.`location_id` | `locations` | Location 1 — 0..* Inventory | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 164 | `inventory`.`organization_id` | `organizations` | Organization 1 — 0..* Inventory | 0..1 (optional) | CASCADE | `organization` (many-to-one) |
| 165 | `inventory_categories`.`organizationId` | `organizations` | Organization 1 — 0..* InventoryCategory | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 166 | `inventory_items`.`categoryId` | `inventory_categories` | InventoryCategory 1 — 0..* InventoryItem | 0..1 (optional) | SET NULL | `category` (many-to-one) |
| 167 | `inventory_items`.`locationId` | `locations` | Location 1 — 0..* InventoryItem | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 168 | `inventory_items`.`organizationId` | `organizations` | Organization 1 — 0..* InventoryItem | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 169 | `patient_consumption_items`.`consumptionId` | `patient_consumptions` | PatientConsumption 1 — 0..* PatientConsumptionItem | 1 (mandatory) | CASCADE | `consumption` (many-to-one) → `items` |
| 170 | `patient_consumption_items`.`inventoryItemId` | `inventory_items` | InventoryItem 1 — 0..* PatientConsumptionItem | 1 (mandatory) | NO ACTION | `inventoryItem` (many-to-one) |
| 171 | `patient_consumptions`.`appointmentId` | `appointments` | Appointment 1 — 0..* PatientConsumption | 0..1 (optional) | SET NULL | `appointment` (many-to-one) |
| 172 | `patient_consumptions`.`locationId` | `locations` | Location 1 — 0..* PatientConsumption | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 173 | `patient_consumptions`.`organizationId` | `organizations` | Organization 1 — 0..* PatientConsumption | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 174 | `patient_consumptions`.`patientId` | `patients` | Patient 1 — 0..* PatientConsumption | 1 (mandatory) | CASCADE | `patient` (many-to-one) |
| 175 | `patient_consumptions`.`performedBy` | `employees` | Employee 1 — 0..* PatientConsumption | 1 (mandatory) | NO ACTION | `doctor` (many-to-one) |
| 176 | `patient_consumptions`.`templateId` | `consumption_templates` | ConsumptionTemplate 1 — 0..* PatientConsumption | 0..1 (optional) | SET NULL | `template` (many-to-one) |
| 177 | `purchase_order_items`.`inventoryItemId` | `inventory_items` | InventoryItem 1 — 0..* PurchaseOrderItem | 1 (mandatory) | NO ACTION | `inventoryItem` (many-to-one) |
| 178 | `purchase_order_items`.`purchaseOrderId` | `purchase_orders` | PurchaseOrder 1 — 0..* PurchaseOrderItem | 1 (mandatory) | CASCADE | `purchaseOrder` (many-to-one) → `items` |
| 179 | `purchase_orders`.`createdBy` | `employees` | Employee 1 — 0..* PurchaseOrder | 1 (mandatory) | NO ACTION | `creator` (many-to-one) |
| 180 | `purchase_orders`.`locationId` | `locations` | Location 1 — 0..* PurchaseOrder | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 181 | `purchase_orders`.`organizationId` | `organizations` | Organization 1 — 0..* PurchaseOrder | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 182 | `purchase_orders`.`supplierId` | `suppliers` | Supplier 1 — 0..* PurchaseOrder | 1 (mandatory) | NO ACTION | `supplier` (many-to-one) |
| 183 | `stock_movements`.`inventoryItemId` | `inventory_items` | InventoryItem 1 — 0..* StockMovement | 1 (mandatory) | CASCADE | `inventoryItem` (many-to-one) → `stockMovements` |
| 184 | `stock_movements`.`performedBy` | `employees` | Employee 1 — 0..* StockMovement | 1 (mandatory) | NO ACTION | `performer` (many-to-one) |
| 185 | `suppliers`.`organizationId` | `organizations` | Organization 1 — 0..* Supplier | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 186 | `chairs`.`location_id` | `locations` | Location 1 — 0..* Chair | 1 (mandatory) | CASCADE | `location` (many-to-one) |
| 187 | `notification_audience_settings`.`organization_id` | `organizations` | Organization 1 — 0..* NotificationAudienceSetting | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 188 | `notification_outbox`.`event_code` | `notification_events` | NotificationEvent 1 — 0..* NotificationOutbox | 1 (mandatory) | RESTRICT | `event` (many-to-one) |
| 189 | `notification_outbox`.`organization_id` | `organizations` | Organization 1 — 0..* NotificationOutbox | 1 (mandatory) | RESTRICT | `organization` (many-to-one) |
| 190 | `notification_rules`.`event_code` | `notification_events` | NotificationEvent 1 — 0..* NotificationRule | 1 (mandatory) | RESTRICT | `event` (many-to-one) |
| 191 | `notification_rules`.`organization_id` | `organizations` | Organization 1 — 0..* NotificationRule | 1 (mandatory) | CASCADE | `organization` (many-to-one) |
| 192 | `notification_rules`.`template_id` | `notification_templates` | NotificationTemplate 1 — 0..* NotificationRule | 0..1 (optional) | SET NULL | `template` (many-to-one) |
| 193 | `notification_templates`.`event_code` | `notification_events` | NotificationEvent 1 — 0..* NotificationTemplate | 1 (mandatory) | RESTRICT | `event` (many-to-one) |
| 194 | `notification_templates`.`organization_id` | `organizations` | Organization 1 — 0..* NotificationTemplate | 0..1 (optional) | CASCADE | `organization` (many-to-one) |
| 195 | `patient_comm_prefs`.`patient_id` | `patients` | Patient 1 — 0..1 PatientCommPref | 1 (mandatory) | CASCADE | `patient` (one-to-one) |
| 196 | `user_notifications`.`outbox_id` | `notification_outbox` | NotificationOutbox 1 — 0..1 UserNotification | 1 (mandatory) | RESTRICT | `outbox` (one-to-one) |
| 197 | `user_notifications`.`user_id` | `users` | User 1 — 0..* UserNotification | 1 (mandatory) | CASCADE | `user` (many-to-one) |
| 198 | `lab_clinic_links`.`lab_id` | `labs` | Lab 1 — 0..* LabClinicLink | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |
| 199 | `lab_clinic_links`.`organization_id` | `organizations` | Organization 1 — 0..* LabClinicLink | 1 (mandatory) | RESTRICT | `organization` (many-to-one) |
| 200 | `lab_members`.`lab_id` | `labs` | Lab 1 — 0..* LabMember | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |
| 201 | `lab_members`.`user_id` | `users` | User 1 — 0..* LabMember | 1 (mandatory) | RESTRICT | `user` (many-to-one) |
| 202 | `labs`.`owner_organization_id` | `organizations` | Organization 1 — 0..* Lab | 0..1 (optional) | RESTRICT | `ownerOrganization` (many-to-one) |
| 203 | `magic_links`.`lab_id` | `labs` | Lab 1 — 0..* MagicLink | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |
| 204 | `magic_links`.`order_id` | `lab_orders` | LabOrder 1 — 0..* MagicLink | 1 (mandatory) | RESTRICT | `order` (many-to-one) |
| 205 | `magic_links`.`organization_id` | `organizations` | Organization 1 — 0..* MagicLink | 1 (mandatory) | RESTRICT | `organization` (many-to-one) |
| 206 | `lab_service_options`.`lab_service_id` | `lab_services` | LabService 1 — 0..* LabServiceOption | 1 (mandatory) | RESTRICT | `labService` (many-to-one) |
| 207 | `lab_service_prices`.`lab_service_id` | `lab_services` | LabService 1 — 0..* LabServicePrice | 1 (mandatory) | RESTRICT | `labService` (many-to-one) |
| 208 | `lab_service_prices`.`organization_id` | `organizations` | Organization 1 — 0..* LabServicePrice | 0..1 (optional) | RESTRICT | `organization` (many-to-one) |
| 209 | `lab_services`.`category_id` | `service_categories` | ServiceCategory 1 — 0..* LabService | 1 (mandatory) | RESTRICT | `category` (many-to-one) |
| 210 | `lab_services`.`form_schema_id` | `form_schemas` | FormSchema 1 — 0..* LabService | 0..1 (optional) | RESTRICT | `formSchema` (many-to-one) |
| 211 | `lab_services`.`lab_id` | `labs` | Lab 1 — 0..* LabService | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |
| 212 | `lab_services`.`specialty_id` | `specialties` | Specialty 1 — 0..* LabService | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 213 | `lab_services`.`stage_template_id` | `stage_templates` | StageTemplate 1 — 0..* LabService | 0..1 (optional) | RESTRICT | `stageTemplate` (many-to-one) |
| 214 | `lab_services`.`workflow_template_id` | `workflow_templates` | WorkflowTemplate 1 — 0..* LabService | 0..1 (optional) | RESTRICT | `workflowTemplate` (many-to-one) |
| 215 | `order_templates`.`lab_id` | `labs` | Lab 1 — 0..* OrderTemplate | 0..1 (optional) | RESTRICT | `lab` (many-to-one) |
| 216 | `order_templates`.`organization_id` | `organizations` | Organization 1 — 0..* OrderTemplate | 1 (mandatory) | RESTRICT | `organization` (many-to-one) |
| 217 | `order_templates`.`specialty_id` | `specialties` | Specialty 1 — 0..* OrderTemplate | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 218 | `service_categories`.`specialty_id` | `specialties` | Specialty 1 — 0..* ServiceCategory | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 219 | `service_mappings`.`clinic_treatment_id` | `services` | CatalogService 1 — 0..* ServiceMapping | 1 (mandatory) | RESTRICT | `clinicTreatment` (many-to-one) |
| 220 | `service_mappings`.`lab_service_id` | `lab_services` | LabService 1 — 0..* ServiceMapping | 1 (mandatory) | RESTRICT | `labService` (many-to-one) |
| 221 | `service_mappings`.`organization_id` | `organizations` | Organization 1 — 0..* ServiceMapping | 1 (mandatory) | RESTRICT | `organization` (many-to-one) |
| 222 | `dental_item_details`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..1 DentalItemDetails | 1 (mandatory) | RESTRICT | `item` (one-to-one) |
| 223 | `item_form_responses`.`form_schema_version_id` | `form_schema_versions` | FormSchemaVersion 1 — 0..* ItemFormResponse | 0..1 (optional) | RESTRICT | `formSchemaVersion` (many-to-one) |
| 224 | `item_form_responses`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..1 ItemFormResponse | 1 (mandatory) | RESTRICT | `item` (one-to-one) |
| 225 | `item_teeth`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..* ItemTooth | 1 (mandatory) | RESTRICT | `item` (many-to-one) |
| 226 | `lab_order_items`.`form_schema_version_id` | `form_schema_versions` | FormSchemaVersion 1 — 0..* LabOrderItem | 0..1 (optional) | RESTRICT | `formSchemaVersion` (many-to-one) |
| 227 | `lab_order_items`.`lab_service_id` | `lab_services` | LabService 1 — 0..* LabOrderItem | 1 (mandatory) | RESTRICT | `labService` (many-to-one) |
| 228 | `lab_order_items`.`order_id` | `lab_orders` | LabOrder 1 — 0..* LabOrderItem | 1 (mandatory) | RESTRICT | `order` (many-to-one) → `items` |
| 229 | `lab_order_items`.`remake_of_item_id` | `lab_order_items` | LabOrderItem 1 — 0..* LabOrderItem | 0..1 (optional) | RESTRICT | `remakeOf` (many-to-one) |
| 230 | `lab_order_items`.`workflow_template_version_id` | `workflow_template_versions` | WorkflowTemplateVersion 1 — 0..* LabOrderItem | 1 (mandatory) | RESTRICT | `workflowTemplateVersion` (many-to-one) |
| 231 | `lab_orders`.`doctor_id` | `employees` | Employee 1 — 0..* LabOrder | 0..1 (optional) | RESTRICT | `doctor` (many-to-one) |
| 232 | `lab_orders`.`lab_clinic_link_id` | `lab_clinic_links` | LabClinicLink 1 — 0..* LabOrder | 1 (mandatory) | RESTRICT | `labClinicLink` (many-to-one) |
| 233 | `lab_orders`.`lab_id` | `labs` | Lab 1 — 0..* LabOrder | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |
| 234 | `lab_orders`.`location_id` | `locations` | Location 1 — 0..* LabOrder | 1 (mandatory) | RESTRICT | `location` (many-to-one) |
| 235 | `lab_orders`.`organization_id` | `organizations` | Organization 1 — 0..* LabOrder | 1 (mandatory) | RESTRICT | `organization` (many-to-one) |
| 236 | `lab_orders`.`patient_id` | `patients` | Patient 1 — 0..* LabOrder | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 237 | `lab_orders`.`specialty_id` | `specialties` | Specialty 1 — 0..* LabOrder | 1 (mandatory) | RESTRICT | `specialty` (many-to-one) |
| 238 | `lab_orders`.`workflow_template_version_id` | `workflow_template_versions` | WorkflowTemplateVersion 1 — 0..* LabOrder | 1 (mandatory) | RESTRICT | `workflowTemplateVersion` (many-to-one) |
| 239 | `order_charge_requests`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..* OrderChargeRequest | 0..1 (optional) | RESTRICT | `item` (many-to-one) |
| 240 | `order_charge_requests`.`order_id` | `lab_orders` | LabOrder 1 — 0..* OrderChargeRequest | 1 (mandatory) | RESTRICT | `order` (many-to-one) |
| 241 | `order_messages`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..* OrderMessage | 0..1 (optional) | RESTRICT | `item` (many-to-one) |
| 242 | `order_messages`.`order_id` | `lab_orders` | LabOrder 1 — 0..* OrderMessage | 1 (mandatory) | RESTRICT | `order` (many-to-one) |
| 243 | `order_revisions`.`order_id` | `lab_orders` | LabOrder 1 — 0..* OrderRevision | 1 (mandatory) | RESTRICT | `order` (many-to-one) |
| 244 | `item_assignments`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..* ItemAssignment | 1 (mandatory) | RESTRICT | `item` (many-to-one) |
| 245 | `item_assignments`.`lab_member_id` | `lab_members` | LabMember 1 — 0..* ItemAssignment | 1 (mandatory) | RESTRICT | `labMember` (many-to-one) |
| 246 | `item_warranties`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..1 ItemWarranty | 1 (mandatory) | RESTRICT | `item` (many-to-one) |
| 247 | `order_item_stages`.`item_id` | `lab_order_items` | LabOrderItem 1 — 0..* OrderItemStage | 1 (mandatory) | RESTRICT | `item` (many-to-one) |
| 248 | `order_item_stages`.`order_id` | `lab_orders` | LabOrder 1 — 0..* OrderItemStage | 1 (mandatory) | RESTRICT | `order` (many-to-one) |
| 249 | `order_item_stages`.`stage_template_step_id` | `stage_template_steps` | StageTemplateStep 1 — 0..* OrderItemStage | 0..1 (optional) | RESTRICT | `stageTemplateStep` (many-to-one) |
| 250 | `order_item_stages`.`workflow_template_version_id` | `workflow_template_versions` | WorkflowTemplateVersion 1 — 0..* OrderItemStage | 1 (mandatory) | RESTRICT | `workflowTemplateVersion` (many-to-one) |
| 251 | `remake_requests`.`new_item_id` | `lab_order_items` | LabOrderItem 1 — 0..1 RemakeRequest | 0..1 (optional) | RESTRICT | `newItem` (many-to-one) |
| 252 | `remake_requests`.`order_id` | `lab_orders` | LabOrder 1 — 0..* RemakeRequest | 1 (mandatory) | RESTRICT | `order` (many-to-one) |
| 253 | `remake_requests`.`original_item_id` | `lab_order_items` | LabOrderItem 1 — 0..* RemakeRequest | 1 (mandatory) | RESTRICT | `originalItem` (many-to-one) |
| 254 | `shipment_items`.`item_stage_id` | `order_item_stages` | OrderItemStage 1 — 0..* ShipmentItem | 0..1 (optional) | RESTRICT | `itemStage` (many-to-one) |
| 255 | `shipment_items`.`order_id` | `lab_orders` | LabOrder 1 — 0..* ShipmentItem | 1 (mandatory) | RESTRICT | `order` (many-to-one) |
| 256 | `shipment_items`.`order_item_id` | `lab_order_items` | LabOrderItem 1 — 0..* ShipmentItem | 1 (mandatory) | RESTRICT | `orderItem` (many-to-one) |
| 257 | `shipment_items`.`shipment_id` | `shipments` | Shipment 1 — 0..* ShipmentItem | 1 (mandatory) | RESTRICT | `shipment` (many-to-one) |
| 258 | `lab_credit_notes`.`invoice_id` | `lab_invoices` | LabInvoice 1 — 0..* LabCreditNote | 1 (mandatory) | RESTRICT | `invoice` (many-to-one) |
| 259 | `lab_invoice_lines`.`invoice_id` | `lab_invoices` | LabInvoice 1 — 0..* LabInvoiceLine | 1 (mandatory) | RESTRICT | `invoice` (many-to-one) → `lines` |
| 260 | `lab_invoice_lines`.`lab_order_item_id` | `lab_order_items` | LabOrderItem 1 — 0..* LabInvoiceLine | 0..1 (optional) | RESTRICT | `labOrderItem` (many-to-one) |
| 261 | `lab_invoice_lines`.`order_charge_request_id` | `order_charge_requests` | OrderChargeRequest 1 — 0..* LabInvoiceLine | 0..1 (optional) | RESTRICT | `orderChargeRequest` (many-to-one) |
| 262 | `lab_invoices`.`order_id` | `lab_orders` | LabOrder 1 — 0..* LabInvoice | 0..1 (optional) | RESTRICT | `order` (many-to-one) |
| 263 | `lab_invoices`.`patient_id` | `patients` | Patient 1 — 0..* LabInvoice | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 264 | `lab_payment_allocations`.`invoice_id` | `lab_invoices` | LabInvoice 1 — 0..* LabPaymentAllocation | 1 (mandatory) | RESTRICT | `invoice` (many-to-one) |
| 265 | `lab_payment_allocations`.`payment_id` | `lab_payments` | LabPayment 1 — 0..* LabPaymentAllocation | 1 (mandatory) | RESTRICT | `payment` (many-to-one) |
| 266 | `lab_payments`.`patient_id` | `patients` | Patient 1 — 0..* LabPayment | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 267 | `lab_payments`.`reversal_of_id` | `lab_payments` | LabPayment 1 — 0..1 LabPayment | 0..1 (optional) | RESTRICT | `reversalOf` (many-to-one) |
| 268 | `lab_refund_sources`.`payment_id` | `lab_payments` | LabPayment 1 — 0..* LabRefundSource | 1 (mandatory) | RESTRICT | `payment` (many-to-one) |
| 269 | `lab_refund_sources`.`refund_id` | `lab_refunds` | LabRefund 1 — 0..* LabRefundSource | 1 (mandatory) | RESTRICT | `refund` (many-to-one) → `sources` |
| 270 | `lab_refunds`.`credit_note_id` | `lab_credit_notes` | LabCreditNote 1 — 0..* LabRefund | 0..1 (optional) | RESTRICT | `creditNote` (many-to-one) |
| 271 | `lab_refunds`.`patient_id` | `patients` | Patient 1 — 0..* LabRefund | 1 (mandatory) | RESTRICT | `patient` (many-to-one) |
| 272 | `lab_statement_lines`.`statement_id` | `lab_statements` | LabStatement 1 — 0..* LabStatementLine | 1 (mandatory) | RESTRICT | `statement` (many-to-one) → `lines` |
| 273 | `lab_statements`.`lab_id` | `labs` | Lab 1 — 0..* LabStatement | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |
| 274 | `vendor_bill_lines`.`vendor_bill_id` | `vendor_bills` | VendorBill 1 — 0..* VendorBillLine | 1 (mandatory) | RESTRICT | `bill` (many-to-one) → `lines` |
| 275 | `vendor_bills`.`lab_id` | `labs` | Lab 1 — 0..* VendorBill | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |
| 276 | `vendor_payment_allocations`.`vendor_bill_id` | `vendor_bills` | VendorBill 1 — 0..* VendorPaymentAllocation | 1 (mandatory) | RESTRICT | `bill` (many-to-one) |
| 277 | `vendor_payment_allocations`.`vendor_payment_id` | `vendor_payments` | VendorPayment 1 — 0..* VendorPaymentAllocation | 1 (mandatory) | RESTRICT | `payment` (many-to-one) → `allocations` |
| 278 | `vendor_payments`.`lab_id` | `labs` | Lab 1 — 0..* VendorPayment | 1 (mandatory) | RESTRICT | `lab` (many-to-one) |

Total: 278 FK constraints.

## 7. Relationships — logical only (no FK)

Columns that hold another row's id but have **no foreign-key constraint**. The database will accept ids that do not exist. Targets are INFERRED unless the basis says otherwise.
Cardinality for all of these is child N : 1 parent (a uuid array is N : M).

### 7.1 Reference columns (excluding tenant scope and actor columns)

| # | Table.column | Type | Null | Likely target | Basis |
|---|---|---|---|---|---|
| 1 | `users`.`last_accessed_organization_id` | uuid | yes | organizations | INFERRED (entity comment states target) — “Last accessed organization — for UX continuity.” |
| 2 | `users`.`last_accessed_location_id` | uuid | yes | locations | INFERRED (entity comment states target) — “Last accessed location — for UX continuity.” |
| 3 | `security_logs`.`session_id` | uuid | yes | user_sessions | INFERRED (entity comment states target) — “Optional session ID if event is session-related.” |
| 4 | `locations`.`manager_id` | uuid | yes | employees or users — not verified | INFERRED (column name) |
| 5 | `config_values`.`scope_id` | uuid | yes | organizations or locations — discriminated by `scope` (comment) | VERIFIED polymorphic (type + id pair, no FK possible) — “Organization or location id; null for platform.” |
| 6 | `patient_communications`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 7 | `patient_consents`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 8 | `patient_documents`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 9 | `patient_feedback`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 10 | `patient_feedback`.`dentist_id` | uuid | yes | employees (or users — not verified) | INFERRED (column name) |
| 11 | `patient_prescriptions`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 12 | `patient_recalls`.`dentist_id` | uuid | yes | employees (or users — not verified) | INFERRED (column name) |
| 13 | `patient_recalls`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 14 | `patient_teeth_chart`.`dentist_id` | uuid | no | employees (or users — not verified) | INFERRED (column name) |
| 15 | `patient_teeth_chart`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 16 | `patient_treatment_plans`.`dentist_id` | uuid | no | employees (or users — not verified) | INFERRED (column name) |
| 17 | `patient_vitals`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 18 | `patients`.`user_id` | uuid | yes | users | INFERRED (column name) |
| 19 | `queue_entries`.`converted_from_appt_id` | uuid | yes | appointments | INFERRED (entity comment states target) — “Walk-in created from a too-late appointment ("Convert to walk-in").” |
| 20 | `queue_entries`.`transferred_from_id` | uuid | yes | queue_entries (self) | INFERRED (entity comment states target) — “The entry this one replaced when transferred from another doctor.” |
| 21 | `queue_events`.`queue_session_id` | uuid | no | queue_sessions | INFERRED (column name) |
| 22 | `queue_events`.`queue_entry_id` | uuid | yes | queue_entries | INFERRED (column name) |
| 23 | `queue_events`.`suggested_entry_id` | uuid | yes | queue_entries | INFERRED (entity comment states target) — “On Select Patient: the entry the engine would have called.” |
| 24 | `queue_events`.`actor_id` | uuid | no | users | INFERRED (column name) |
| 25 | `treatments`.`service_id` | uuid | yes | services | INFERRED (column name) — “Catalog service (kind PROCEDURE) — billing prices the charge from it.” |
| 26 | `doctor_signatures`.`employee_id` | uuid | no | users (stores users.uuid despite the name) | INFERRED (entity comment states target) — “Owner of the signature. Currently set to the authenticated user's UUID (`req.user.uuid`). When a User→Employe…” |
| 27 | `billing_audit_logs`.`entity_id` | uuid | no | polymorphic — discriminated by `entity_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 28 | `billing_audit_logs`.`actor_id` | uuid | no | users | INFERRED (column name) |
| 29 | `cash_close_lines`.`payment_account_id` | uuid | no | payment_accounts | INFERRED (column name) |
| 30 | `charges`.`source_id` | uuid | yes | polymorphic — discriminated by `source_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 31 | `charges`.`encounter_id` | uuid | yes | patient_encounters | INFERRED (entity comment states target) — “The visit (patient encounter) the charge comes from, when known.” |
| 32 | `charges`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 33 | `charges`.`service_id` | uuid | yes | services | INFERRED (column name) |
| 34 | `charges`.`discount_type_id` | uuid | yes | discount_types | INFERRED (column name) |
| 35 | `commission_entries`.`source_id` | uuid | no | polymorphic — discriminated by `source_type` | VERIFIED polymorphic (type + id pair, no FK possible) — “The payment (new money) or the operation id that caused the entry.” |
| 36 | `discount_types`.`service_ids` | uuid[] | yes | services (uuid[]) | INFERRED (column name) |
| 37 | `expenses`.`lab_id` | uuid | yes | labs | INFERRED (column name) — “Lab case cost (lab ERD §6c): the lab and / or lab order it was spent on.” |
| 38 | `expenses`.`lab_order_id` | uuid | yes | lab_orders | INFERRED (column name) |
| 39 | `ledger_entries`.`patient_id` | uuid | no | patients | INFERRED (column name) |
| 40 | `ledger_entries`.`invoice_id` | uuid | yes | invoices | INFERRED (column name) |
| 41 | `ledger_entries`.`payment_id` | uuid | yes | payments | INFERRED (column name) |
| 42 | `ledger_entries`.`refund_id` | uuid | yes | refunds | INFERRED (column name) |
| 43 | `ledger_journal_lines`.`patient_id` | uuid | yes | patients | INFERRED (column name) |
| 44 | `ledger_journal_lines`.`lab_id` | uuid | yes | labs | INFERRED (column name) |
| 45 | `ledger_journal_lines`.`doctor_id` | uuid | yes | employees | INFERRED (column name) |
| 46 | `ledger_journal_lines`.`lab_order_id` | uuid | yes | lab_orders | INFERRED (column name) |
| 47 | `ledger_journals`.`source_id` | uuid | no | polymorphic — discriminated by `source_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 48 | `ledger_journals`.`reversal_of_id` | uuid | yes | ledger_journals (self) | INFERRED (column name) |
| 49 | `location_billing_settings`.`default_consultation_service_id` | uuid | yes | services | INFERRED (column name) |
| 50 | `location_billing_settings`.`default_payment_account_id` | uuid | yes | payment_accounts | INFERRED (column name) |
| 51 | `payment_allocations`.`patient_id` | uuid | no | patients | INFERRED (column name) |
| 52 | `payment_allocations`.`invoice_id` | uuid | no | invoices | INFERRED (column name) — “Copy of the charge's invoice at write time (fast invoice queries).” |
| 53 | `refunds`.`payment_account_id` | uuid | no | payment_accounts | INFERRED (column name) |
| 54 | `refunds`.`invoice_id` | uuid | yes | invoices | INFERRED (column name) |
| 55 | `patient_consumptions`.`treatmentPlanId` | uuid | yes | patient_treatment_plans (or treatment_plan_templates — not verified) | INFERRED (column name) |
| 56 | `stock_movements`.`referenceId` | character varying | yes | polymorphic — discriminated by `referenceType` (if present) | VERIFIED polymorphic (type + id pair, no FK possible) — “What triggered this movement: 'purchase_order' \| 'appointment' \| 'treatment_plan' \| 'manual' \| 'transfer'” |
| 57 | `notification_outbox`.`recipient_id` | uuid | no | polymorphic — discriminated by `recipient_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 58 | `notification_outbox`.`entity_id` | uuid | yes | polymorphic — discriminated by `entity_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 59 | `magic_links`.`shipment_id` | uuid | yes | shipments | INFERRED (entity comment states target) — “Shipment links (Sprint 8); no FK until that table exists here.” |
| 60 | `order_templates`.`owner_user_id` | uuid | yes | users | INFERRED (column name) — “Null = shared with every doctor of the clinic.” |
| 61 | `attachments`.`entity_id` | uuid | no | polymorphic — discriminated by `entity_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 62 | `attachments`.`order_id` | uuid | no | lab_orders | INFERRED (entity comment states target) — “The order the file belongs to (also for item files) — for scoping.” |
| 63 | `lab_order_items`.`clinic_treatment_id` | uuid | yes | services | INFERRED (entity comment states target) — “Billing `services.id` the patient is charged as (see Sprint 5 deviation 1).” |
| 64 | `lab_order_items`.`option_ids` | uuid[] | no | lab_service_options (uuid[]) | INFERRED (column name) — “Chosen lab options (ids) — the draft input; frozen as `options_snap`.” |
| 65 | `lab_order_items`.`lab_price_id` | uuid | yes | lab_service_prices | INFERRED (entity comment states target) — “The `lab_service_prices` row the cost came from.” |
| 66 | `lab_order_items`.`stage_template_id` | uuid | yes | stage_templates | INFERRED (entity comment states target) — “Stage template of the service, copied for Sprint 8's `init_stages`.” |
| 67 | `lab_orders`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) |
| 68 | `lab_orders`.`treatment_id` | uuid | yes | treatments | INFERRED (entity comment states target) — “The patient's treatment record this case belongs to (optional).” |
| 69 | `lab_orders`.`order_template_id` | uuid | yes | order_templates | INFERRED (entity comment states target) — “The order template the draft started from (counted at submit).” |
| 70 | `order_messages`.`author_user_id` | uuid | yes | users | INFERRED (column name) |
| 71 | `item_assignments`.`lab_id` | uuid | no | labs | INFERRED (column name) |
| 72 | `order_item_stages`.`lab_id` | uuid | no | labs | INFERRED (column name) — “The order's lab — lab portal reads filter on it.” |
| 73 | `order_item_stages`.`appointment_id` | uuid | yes | appointments | INFERRED (column name) — “The try-in appointment (optional link).” |
| 74 | `remake_requests`.`lab_id` | uuid | no | labs | INFERRED (column name) |
| 75 | `remake_requests`.`warranty_id` | uuid | yes | item_warranties | INFERRED (column name) |
| 76 | `shipments`.`lab_id` | uuid | no | labs | INFERRED (column name) |
| 77 | `lab_credit_notes`.`patient_id` | uuid | no | patients | INFERRED (column name) |
| 78 | `lab_invoice_lines`.`clinic_treatment_id` | uuid | yes | services | INFERRED (entity comment states target) — “Billing `services.id` (from the item's frozen mapping).” |
| 79 | `lab_invoice_lines`.`doctor_id` | uuid | yes | employees | INFERRED (entity comment states target) — “The doctor credited for the work (employee) — commission input.” |
| 80 | `lab_invoice_lines`.`performing_assignment_id` | uuid | yes | employee_org_location_assignments | INFERRED (entity comment states target) — “Commission snapshot taken at issue (like billing v2's charges): the doctor's assignment at the invoice's loca…” |
| 81 | `lab_invoice_lines`.`commission_plan_id` | uuid | yes | compensation_plans | INFERRED (column name) |
| 82 | `lab_statement_lines`.`matched_bill_line_id` | uuid | yes | vendor_bill_lines | INFERRED (column name) |
| 83 | `lab_statement_lines`.`matched_bill_id` | uuid | yes | vendor_bills | INFERRED (column name) |
| 84 | `lab_statements`.`attachment_id` | uuid | yes | attachments | INFERRED (entity comment states target) — “No storage for statement files yet (attachments are order-scoped).” |
| 85 | `vendor_bill_lines`.`lab_order_id` | uuid | yes | lab_orders | INFERRED (column name) |
| 86 | `vendor_bill_lines`.`order_item_id` | uuid | yes | lab_order_items | INFERRED (column name) |
| 87 | `vendor_bill_lines`.`charge_request_id` | uuid | yes | order_charge_requests | INFERRED (column name) |
| 88 | `vendor_bill_lines`.`remake_request_id` | uuid | yes | remake_requests | INFERRED (column name) |
| 89 | `vendor_bills`.`lab_order_id` | uuid | yes | lab_orders | INFERRED (column name) — “The order the draft was made for; null for a manual bill.” |
| 90 | `vendor_bills`.`statement_id` | uuid | yes | lab_statements | INFERRED (column name) |
| 91 | `vendor_bills`.`journal_id` | uuid | yes | ledger_journals | INFERRED (entity comment states target) — “The Lab Cost / Lab Payable journal.” |
| 92 | `audit_logs`.`entity_id` | uuid | no | polymorphic — discriminated by `entity_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 93 | `audit_logs`.`subject_id` | uuid | yes | polymorphic — the record whose history this row joins (comment) | VERIFIED polymorphic (type + id pair, no FK possible) — “The record this row's history belongs to, when that is not the entity itself (a patient's vitals → the patien…” |
| 94 | `audit_logs`.`actor_user_id` | uuid | yes | users | INFERRED (column name) |
| 95 | `status_history`.`entity_id` | uuid | no | polymorphic — discriminated by `entity_type` | VERIFIED polymorphic (type + id pair, no FK possible) |
| 96 | `status_history`.`subject_id` | uuid | yes | polymorphic — the record whose history this row joins (comment) | VERIFIED polymorphic (type + id pair, no FK possible) — “Same as `audit_logs.subject_id`: the record whose history this joins.” |
| 97 | `status_history`.`actor_user_id` | uuid | yes | users | INFERRED (column name) |
| 98 | `status_history`.`on_behalf_of_lab_id` | uuid | yes | labs | INFERRED (entity comment states target) — “Set when clinic staff updated on the lab's behalf (`via = proxy`).” |

### 7.2 Tenant-scope columns without an FK

`organization_id` / `location_id` present but not FK-constrained (target `organizations.id` / `locations.id`, INFERRED by name).

| Table | organization_id | location_id |
|---|---|---|
| `location_feature_overrides` (feature-flags) | no FK | FK |
| `outbox` (queue) | no FK | — |
| `queue_entries` (queue) | no FK | — |
| `queue_events` (queue) | no FK | — |
| `queue_policies` (queue) | no FK | no FK |
| `queue_sessions` (queue) | no FK | no FK |
| `plan_templates` (plan-templates) | no FK | — |
| `billing_audit_logs` (billing) | no FK | no FK |
| `cash_closes` (billing) | no FK | no FK |
| `charges` (billing) | no FK | no FK |
| `commission_entries` (billing) | no FK | no FK |
| `commission_settlements` (billing) | no FK | no FK |
| `compensation_plans` (billing) | no FK | — |
| `discount_types` (billing) | no FK | — |
| `invoices` (billing) | no FK | no FK |
| `ledger_entries` (billing) | no FK | no FK |
| `ledger_journal_lines` (billing) | no FK | no FK |
| `ledger_journals` (billing) | no FK | no FK |
| `location_billing_settings` (billing) | no FK | FK |
| `payment_accounts` (billing) | no FK | no FK |
| `payment_allocations` (billing) | no FK | no FK |
| `payments` (billing) | no FK | no FK |
| `refund_sources` (billing) | no FK | — |
| `refunds` (billing) | no FK | no FK |
| `service_prices` (billing) | no FK | no FK |
| `services` (billing) | no FK | — |
| `stock_movements` (inventory) | no FK | no FK |
| `notification_outbox` (notifications) | FK | no FK |
| `patient_comm_prefs` (notifications) | no FK | — |
| `user_notifications` (notifications) | no FK | — |
| `attachments` (lab-orders) | no FK | — |
| `dental_item_details` (lab-orders) | no FK | — |
| `item_form_responses` (lab-orders) | no FK | — |
| `item_teeth` (lab-orders) | no FK | — |
| `lab_order_items` (lab-orders) | no FK | — |
| `order_charge_requests` (lab-orders) | no FK | — |
| `order_messages` (lab-orders) | no FK | — |
| `order_revisions` (lab-orders) | no FK | — |
| `item_assignments` (lab-production) | no FK | — |
| `item_warranties` (lab-production) | no FK | — |
| `order_item_stages` (lab-production) | no FK | — |
| `remake_requests` (lab-production) | no FK | — |
| `shipment_items` (lab-production) | no FK | — |
| `shipments` (lab-production) | no FK | — |
| `lab_credit_notes` (lab-billing) | no FK | no FK |
| `lab_invoice_lines` (lab-billing) | no FK | — |
| `lab_invoices` (lab-billing) | no FK | no FK |
| `lab_payment_allocations` (lab-billing) | no FK | — |
| `lab_payments` (lab-billing) | no FK | no FK |
| `lab_refund_sources` (lab-billing) | no FK | — |
| `lab_refunds` (lab-billing) | no FK | no FK |
| `lab_statement_lines` (lab-payables) | no FK | — |
| `lab_statements` (lab-payables) | no FK | — |
| `vendor_bill_lines` (lab-payables) | no FK | — |
| `vendor_bills` (lab-payables) | no FK | no FK |
| `vendor_payment_allocations` (lab-payables) | no FK | — |
| `vendor_payments` (lab-payables) | no FK | no FK |
| `audit_logs` (common) | no FK | — |
| `status_history` (common) | no FK | — |

### 7.3 Actor columns (who did it)

All are `uuid` with no FK. INFERRED target `users.uuid`: services write them from `actor.userId` / `user.uuid` (spot-checked, e.g. 21× `createdBy: actor.userId`).

| Table | Columns |
|---|---|
| `locations` | `created_by`, `updated_by` |
| `nav_layouts` | `updated_by` |
| `location_feature_overrides` | `updated_by` |
| `org_feature_flags` | `enabled_by`, `entitled_by` |
| `config_values` | `updated_by` |
| `subscription_payments` | `recorded_by` |
| `doctor_availability_overrides` | `created_by` |
| `employee_leaves` | `approved_by`, `created_by` |
| `employee_org_location_assignments` | `created_by` |
| `employee_schedules` | `created_by` |
| `payroll_records` | `paid_by`, `created_by` |
| `patient_communications` | `sent_by` |
| `patient_consents` | `witnessed_by` |
| `patient_documents` | `uploaded_by` |
| `patient_feedback` | `responded_by` |
| `patient_prescriptions` | `prescribed_by` |
| `patient_recalls` | `created_by` |
| `patient_treatment_plans` | `created_by` |
| `patient_vitals` | `recorded_by`, `anesthesia_administered_by` |
| `patients` | `created_by` |
| `treatment_plan_items` | `assigned_to` |
| `appointments` | `created_by`, `updated_by` |
| `patient_encounters` | `created_by`, `updated_by` |
| `treatments` | `created_by` |
| `plan_templates` | `created_by` |
| `prescription_history` | `changed_by` |
| `prescription_templates` | `created_by` |
| `treatment_plan_templates` | `created_by` |
| `form_schema_versions` | `published_by`, `created_by`, `updated_by` |
| `form_schemas` | `created_by`, `updated_by` |
| `organization_specialties` | `updated_by` |
| `specialties` | `created_by`, `updated_by` |
| `stage_templates` | `created_by`, `updated_by` |
| `workflow_template_versions` | `published_by`, `created_by`, `updated_by` |
| `workflow_templates` | `created_by`, `updated_by` |
| `cash_closes` | `closed_by` |
| `charges` | `discount_applied_by`, `voided_by`, `created_by` |
| `commission_settlements` | `paid_by` |
| `compensation_plans` | `created_by` |
| `discount_types` | `created_by` |
| `invoices` | `issued_by`, `last_edited_by`, `cancelled_by` |
| `ledger_entries` | `created_by` |
| `ledger_journals` | `created_by` |
| `location_billing_settings` | `updated_by` |
| `payment_allocations` | `created_by` |
| `payments` | `received_by` |
| `refunds` | `refunded_by` |
| `notification_audience_settings` | `created_by`, `updated_by` |
| `notification_rules` | `created_by`, `updated_by` |
| `notification_templates` | `created_by`, `updated_by` |
| `patient_comm_prefs` | `updated_by` |
| `lab_clinic_links` | `created_by`, `updated_by` |
| `lab_members` | `created_by`, `updated_by` |
| `labs` | `created_by`, `updated_by` |
| `magic_links` | `revoked_by`, `created_by` |
| `lab_service_options` | `created_by`, `updated_by` |
| `lab_service_prices` | `created_by`, `updated_by` |
| `lab_services` | `created_by`, `updated_by` |
| `order_templates` | `created_by`, `updated_by` |
| `service_categories` | `created_by`, `updated_by` |
| `service_mappings` | `created_by`, `updated_by` |
| `attachments` | `uploaded_by` |
| `lab_order_items` | `created_by`, `updated_by` |
| `lab_orders` | `created_by`, `updated_by` |
| `order_charge_requests` | `requested_by`, `decided_by` |
| `order_revisions` | `created_by`, `lab_acknowledged_by` |
| `item_assignments` | `assigned_by`, `unassigned_by` |
| `order_item_stages` | `decided_by` |
| `remake_requests` | `requested_by`, `decided_by` |
| `shipment_items` | `received_by` |
| `shipments` | `dispatched_by`, `received_by` |
| `lab_billing_settings` | `updated_by` |
| `lab_credit_notes` | `created_by` |
| `lab_invoices` | `issued_by`, `voided_by`, `created_by`, `updated_by` |
| `lab_payment_allocations` | `created_by`, `reversed_by` |
| `lab_payments` | `received_by` |
| `lab_refunds` | `refunded_by` |
| `lab_statements` | `created_by` |
| `vendor_bills` | `approved_by`, `voided_by`, `created_by` |
| `vendor_payment_allocations` | `created_by` |
| `vendor_payments` | `reversed_by`, `created_by` |

## 8. Tenant scope

Scope columns per table (VERIFIED presence). Classification of whether a table *should* carry them is INFERRED.

| Table | Module | organization | location | Classification |
|---|---|---|---|---|
| `users` | user | ✘ | ✘ | global — platform identity (one user, many orgs) |
| `oauth_providers` | auth | ✘ | ✘ | global — per user |
| `security_logs` | auth | ✘ | ✘ | global — per user/session |
| `user_sessions` | session | ✘ | ✘ | global — per user |
| `organization_ownership` | organizations | ✔ | ✘ | org |
| `organization_settings` | organizations | ✔ | ✘ | org |
| `organizations` | organizations | ✘ | ✘ | global — the tenant root itself |
| `location_settings` | locations | ✔ | ✔ | org + location |
| `locations` | locations | ✔ | ✘ | org |
| `nav_layouts` | access | ✔ | ✘ | org |
| `feature_catalog` | feature-flags | ✘ | ✘ | global — platform catalog |
| `location_feature_overrides` | feature-flags | ✔ | ✔ | org + location |
| `org_feature_flags` | feature-flags | ✔ | ✘ | org |
| `config_values` | settings-registry | ✘ | ✘ | global — cascade platform → org → location via scope + scope_id |
| `subscription_payments` | subscriptions | ✔ | ✘ | org |
| `doctor_availability_overrides` | employees | ✔ | ✔ | org + location |
| `employee_leaves` | employees | ✔ | ✔ | org + location |
| `employee_org_location_assignments` | employees | ✔ | ✔ | org + location |
| `employee_schedules` | employees | ✔ | ✔ | org + location |
| `employees` | employees | ✘ | ✘ | global — person record shared across orgs; scope lives on employee_org_location_assignments |
| `employment_roles` | employees | ✔ | ✘ | org |
| `payroll_records` | payroll | ✔ | ✔ | org + location |
| `patient_communications` | patients | ✔ | ✔ | org + location |
| `patient_consents` | patients | ✔ | ✔ | org + location |
| `patient_dental_info` | patients | ✔ | ✘ | org |
| `patient_documents` | patients | ✔ | ✔ | org + location |
| `patient_feedback` | patients | ✔ | ✔ | org + location |
| `patient_insurance` | patients | ✔ | ✘ | org |
| `patient_prescriptions` | patients | ✔ | ✔ | org + location |
| `patient_recalls` | patients | ✔ | ✔ | org + location |
| `patient_referrals` | patients | ✔ | ✘ | org |
| `patient_teeth_chart` | patients | ✔ | ✔ | org + location |
| `patient_treatment_plans` | patients | ✔ | ✔ | org + location |
| `patient_visits` | patients | ✔ | ✔ | org + location |
| `patient_vitals` | patients | ✔ | ✔ | org + location |
| `patients` | patients | ✔ | ✘ | org |
| `treatment_plan_items` | patients | ✘ | ✘ | **no org column** — scoped only through `patient_treatment_plans` |
| `appointments` | appointments | ✔ | ✔ | org + location |
| `idempotency_keys` | queue | ✔ | ✘ | org |
| `outbox` | queue | ✔ | ✘ | org |
| `queue_entries` | queue | ✔ | ✘ | org |
| `queue_events` | queue | ✔ | ✘ | org |
| `queue_policies` | queue | ✔ | ✔ | org + location |
| `queue_sessions` | queue | ✔ | ✔ | org + location |
| `patient_encounters` | encounters | ✔ | ✔ | org + location |
| `treatments` | treatments | ✔ | ✔ | org + location |
| `plan_templates` | plan-templates | ✔ | ✘ | org |
| `doctor_signatures` | prescriptions | ✔ | ✘ | org |
| `medicine_directory` | prescriptions | ✔ | ✘ | org |
| `prescription_history` | prescriptions | ✘ | ✘ | **no org column** — scoped only through `prescriptions` |
| `prescription_medicines` | prescriptions | ✘ | ✘ | **no org column** — scoped only through `prescriptions`, `medicine_directory` |
| `prescription_templates` | prescriptions | ✔ | ✔ | org + location |
| `prescriptions` | prescriptions | ✔ | ✔ | org + location |
| `treatment_plan_template_medicines` | prescriptions | ✘ | ✘ | **no org column** — scoped only through `treatment_plan_templates`, `medicine_directory` |
| `treatment_plan_templates` | prescriptions | ✔ | ✘ | org |
| `form_schema_versions` | engine | ✘ | ✘ | platform-or-org — inherits nullable `organization_id` of its template (INFERRED) |
| `form_schemas` | engine | ✔ | ✘ | org |
| `organization_specialties` | engine | ✔ | ✘ | org |
| `specialties` | engine | ✘ | ✘ | global — platform catalog |
| `stage_template_steps` | engine | ✘ | ✘ | platform-or-org — inherits nullable `organization_id` of its template (INFERRED) |
| `stage_templates` | engine | ✔ | ✘ | org |
| `transition_effects` | engine | ✘ | ✘ | platform-or-org — inherits nullable `organization_id` of its template (INFERRED) |
| `workflow_effects` | engine | ✘ | ✘ | global — platform catalog |
| `workflow_states` | engine | ✘ | ✘ | platform-or-org — inherits nullable `organization_id` of its template (INFERRED) |
| `workflow_template_versions` | engine | ✘ | ✘ | platform-or-org — inherits nullable `organization_id` of its template (INFERRED) |
| `workflow_templates` | engine | ✔ | ✘ | org |
| `workflow_transitions` | engine | ✘ | ✘ | platform-or-org — inherits nullable `organization_id` of its template (INFERRED) |
| `billing_audit_logs` | billing | ✔ | ✔ | org + location |
| `cash_close_lines` | billing | ✘ | ✘ | **no org column** — scoped only through `cash_closes` |
| `cash_closes` | billing | ✔ | ✔ | org + location |
| `charges` | billing | ✔ | ✔ | org + location |
| `commission_entries` | billing | ✔ | ✔ | org + location |
| `commission_rules` | billing | ✘ | ✘ | **no org column** — scoped only through `compensation_plans`, `services` |
| `commission_settlements` | billing | ✔ | ✔ | org + location |
| `compensation_plans` | billing | ✔ | ✘ | org |
| `credit_packages` | billing | ✔ | ✘ | org |
| `discount_types` | billing | ✔ | ✘ | org |
| `document_sequences` | billing | ✔ | ✔ | org + location |
| `expenses` | billing | ✔ | ✔ | org + location |
| `invoices` | billing | ✔ | ✔ | org + location |
| `ledger_entries` | billing | ✔ | ✔ | org + location |
| `ledger_journal_lines` | billing | ✔ | ✔ | org + location |
| `ledger_journals` | billing | ✔ | ✔ | org + location |
| `location_billing_settings` | billing | ✔ | ✔ | org + location |
| `patient_credits` | billing | ✔ | ✘ | org |
| `payment_accounts` | billing | ✔ | ✔ | org + location |
| `payment_allocations` | billing | ✔ | ✔ | org + location |
| `payments` | billing | ✔ | ✔ | org + location |
| `refund_sources` | billing | ✔ | ✘ | org |
| `refunds` | billing | ✔ | ✔ | org + location |
| `service_prices` | billing | ✔ | ✔ | org + location |
| `services` | billing | ✔ | ✘ | org |
| `consumption_template_items` | inventory | ✘ | ✘ | **no org column** — scoped only through `consumption_templates`, `inventory_items` |
| `consumption_templates` | inventory | ✔ | ✘ | org |
| `inventory` | inventory | ✔ | ✔ | org + location |
| `inventory_categories` | inventory | ✔ | ✘ | org |
| `inventory_items` | inventory | ✔ | ✔ | org + location |
| `patient_consumption_items` | inventory | ✘ | ✘ | **no org column** — scoped only through `patient_consumptions`, `inventory_items` |
| `patient_consumptions` | inventory | ✔ | ✔ | org + location |
| `purchase_order_items` | inventory | ✘ | ✘ | **no org column** — scoped only through `purchase_orders`, `inventory_items` |
| `purchase_orders` | inventory | ✔ | ✔ | org + location |
| `stock_movements` | inventory | ✔ | ✔ | org + location |
| `suppliers` | inventory | ✔ | ✘ | org |
| `chairs` | chairs | ✘ | ✔ | **location only** — org reachable via `locations` |
| `notification_audience_settings` | notifications | ✔ | ✘ | org |
| `notification_events` | notifications | ✘ | ✘ | global — platform catalog |
| `notification_outbox` | notifications | ✔ | ✔ | org + location |
| `notification_rules` | notifications | ✔ | ✘ | org |
| `notification_templates` | notifications | ✔ | ✘ | org |
| `patient_comm_prefs` | notifications | ✔ | ✘ | org |
| `user_notifications` | notifications | ✔ | ✘ | org |
| `lab_clinic_links` | labs | ✔ | ✘ | org |
| `lab_members` | labs | ✘ | ✘ | global — lab-side (scoped by lab_id) |
| `labs` | labs | ✔ | ✘ | global — external labs are cross-tenant (internal labs carry owner_organization_id) |
| `magic_links` | lab-access | ✔ | ✘ | org |
| `lab_service_options` | lab-catalog | ✘ | ✘ | global — lab-side (scoped via lab_services.lab_id) |
| `lab_service_prices` | lab-catalog | ✔ | ✘ | org |
| `lab_services` | lab-catalog | ✘ | ✘ | global — lab-side (scoped by lab_id) |
| `order_templates` | lab-catalog | ✔ | ✘ | org |
| `service_categories` | lab-catalog | ✘ | ✘ | global — platform catalog (per specialty) |
| `service_mappings` | lab-catalog | ✔ | ✘ | org |
| `attachments` | lab-orders | ✔ | ✘ | org |
| `dental_item_details` | lab-orders | ✔ | ✘ | org |
| `item_form_responses` | lab-orders | ✔ | ✘ | org |
| `item_teeth` | lab-orders | ✔ | ✘ | org |
| `lab_order_items` | lab-orders | ✔ | ✘ | org |
| `lab_orders` | lab-orders | ✔ | ✔ | org + location |
| `order_charge_requests` | lab-orders | ✔ | ✘ | org |
| `order_messages` | lab-orders | ✔ | ✘ | org |
| `order_revisions` | lab-orders | ✔ | ✘ | org |
| `item_assignments` | lab-production | ✔ | ✘ | org |
| `item_warranties` | lab-production | ✔ | ✘ | org |
| `order_item_stages` | lab-production | ✔ | ✘ | org |
| `remake_requests` | lab-production | ✔ | ✘ | org |
| `shipment_items` | lab-production | ✔ | ✘ | org |
| `shipments` | lab-production | ✔ | ✘ | org |
| `lab_billing_settings` | lab-billing | ✔ | ✘ | org |
| `lab_credit_notes` | lab-billing | ✔ | ✔ | org + location |
| `lab_invoice_lines` | lab-billing | ✔ | ✘ | org |
| `lab_invoices` | lab-billing | ✔ | ✔ | org + location |
| `lab_payment_allocations` | lab-billing | ✔ | ✘ | org |
| `lab_payments` | lab-billing | ✔ | ✔ | org + location |
| `lab_refund_sources` | lab-billing | ✔ | ✘ | org |
| `lab_refunds` | lab-billing | ✔ | ✔ | org + location |
| `lab_statement_lines` | lab-payables | ✔ | ✘ | org |
| `lab_statements` | lab-payables | ✔ | ✘ | org |
| `vendor_bill_lines` | lab-payables | ✔ | ✘ | org |
| `vendor_bills` | lab-payables | ✔ | ✔ | org + location |
| `vendor_payment_allocations` | lab-payables | ✔ | ✘ | org |
| `vendor_payments` | lab-payables | ✔ | ✔ | org + location |
| `audit_logs` | common | ✔ | ✘ | org |
| `number_sequences` | common | ✔ | ✘ | org |
| `status_history` | common | ✔ | ✘ | org |

**Tenant-data tables with no organization column (excluding global, lab-side and template-version tables): 10.** Each is listed above with the parent it is scoped through. Queries on these tables must join the parent to enforce isolation.

## 9. Ownership — unclear or shared

Every entity is assigned to the module folder that defines it (section 4). These assignments are the weak ones:

| Entity (table) | Assigned to | Why it is unclear |
|---|---|---|
| `Chair` (`chairs`) | `chairs` | The folder has only an entity; there is no Nest module, no `forFeature` registration, no service or controller. Its only FK is to `locations`, and the baseline's `appointments.chair_id` link no longer exists. Not in the dev schema. VERIFIED |
| `Inventory` (`inventory`) | `inventory` | Lives in `inventory/entities` but `InventoryModule` does not register it. It looks superseded by `InventoryItem` / `StockMovement` (INFERRED). Not in the dev schema. VERIFIED (registration) |
| `EmploymentRole` (`employment_roles`) | `employees` | Defined in `employees/`, but the permission model that reads it lives in `access/`, and CLAUDE.md says `organizations/` owns "employee role definitions". Registered by `access`, `feature-flags` and `employees`. |
| `Specialty`, `OrganizationSpecialty` | `engine` | Clinic specialties are also stored as `organizations.clinic_type` / `specialty_tags`. The engine owns the table, but org setup uses it too. |
| `IdempotencyKey` (`idempotency_keys`) | `queue` | Only the queue writes it (VERIFIED), but there is also a `common/idempotency` Nest module (with no entity), and the lab migration's header notes that `idempotency_keys` "already exists from the queue". |
| `Expense` (`expenses`) | `billing` | Has `lab_id` / `lab_order_id` for lab case costs. The `lab-finance` module has no entities of its own, so lab costs are split between `billing` and `lab-payables`. |
| `LedgerJournal`, `LedgerJournalLine` | `billing` | They live in `billing/ledger/journal` with their own `GeneralLedgerModule`, and lab ERD §6c designed them. The lab modules write to them too (`vendor_bills.journal_id`). |
| `AuditLog`, `StatusHistory`, `NumberSequence` | `common` | Generic infrastructure. The lab ERD introduced them. About 18 modules now reference them, including billing, patients, engine and every lab module (VERIFIED by grep). |

The following modules have **no entities**: `reports`, `lab-finance`, `common/clock`, `common/idempotency`, `common/storage`, `common/cloudinary`. VERIFIED.

## 10. Ambiguities and open questions

**Overlapping concepts.** Two or more tables model nearly the same thing. All are VERIFIED to exist. Each table's role is quoted from its class comment.

| Concept | Tables | What the code says |
|---|---|---|
| Prescriptions | `patient_prescriptions` (patients) and `prescriptions` (prescriptions) | `Prescription` comment: it "coexists with the legacy `patient_prescriptions` table" while consumers migrate. |
| Visits | `patient_visits`, `patient_encounters`, `appointments`, `queue_entries` | `PatientEncounter` is the clinical record, one per queue entry. Its comment notes it is distinct from `PatientVisit`. Judging by its columns, `patient_visits` is a per-location visit summary (INFERRED). |
| Treatment plans | `patient_treatment_plans` + `treatment_plan_items` (patients), `treatments` (treatments), `plan_templates` (plan-templates), `treatment_plan_templates` (prescriptions) | `PlanTemplate` comment warns it is not `treatment_plan_templates`, which holds prescription protocols. `Treatment` holds work actually performed. The plan tables hold planned work. |
| Audit | `audit_logs`, `status_history` (common), `billing_audit_logs` (billing), `prescription_history`, `queue_events` | `BillingAuditLog` comment says "the repo has no general audit module", but `audit_logs` now exists. Billing still keeps its own. |
| Ledgers | `ledger_entries` (the patient statement, one-sided) and `ledger_journals` / `ledger_journal_lines` (double-entry GL) | Both comments say so explicitly. |
| Outbox | `outbox` (queue realtime) and `notification_outbox` (messages) | Separate purposes, similar names. |
| Counters | `document_sequences` (billing: per location / type / year) and `number_sequences` (common: per org) | Two sequence mechanisms. |
| Services | `services` (class `CatalogService`, the clinic's billable catalog) and `lab_services` (the lab's catalog), linked by `service_mappings` | The class name differs from the table name. Lab columns call a `services.id` `clinic_treatment_id`. |

**Logical references whose target is not certain.** These are INFERRED, so verify them before drawing them:

- `dentist_id` on `patient_teeth_chart`, `patient_treatment_plans`, `patient_recalls`, `patient_feedback`: the target could be `employees.id` or `users.uuid`. Only DTOs mention `dentistId: string`.
- `doctor_signatures.employee_id`: its comment says it "currently" stores `req.user.uuid`, a **user** id, despite the column name.
- `locations.manager_id`: the target could be `employees` or `users`. Nothing in the code says which.
- `patient_consumptions.treatmentPlanId` (inventory): probably `patient_treatment_plans`. Not verified.
- `notification_outbox.recipient_id` is polymorphic by `recipient_type`, and `config_values.scope_id` by `scope`.
- `stock_movements.referenceId` is a `varchar`, not a uuid, and polymorphic.

**References that look like a missing FK, not a design choice:**

- `magic_links.shipment_id`: its comment says "no FK until that table exists here", but `shipments` now exists. VERIFIED (both facts).
- `lab_order_items.clinic_treatment_id` has no FK, but `service_mappings.clinic_treatment_id` has one to the same `services` table. VERIFIED.
- Nearly all billing v2 tables keep `organization_id` / `location_id` without FKs, while older modules constrain them (section 7.2). This could be deliberate, since append-only ledgers avoid FKs, but no comment says so.

**"Append-only" that the database does not enforce.** Class comments call `ledger_entries`, `ledger_journals`, `billing_audit_logs` and `notification_outbox` append-only. Only `commission_entries`, `audit_logs` and `status_history` have triggers that enforce it. VERIFIED.

**Naming inconsistency.** The ten `inventory` tables use camelCase column names (`organizationId`, `locationId`, `treatmentPlanId`, …). Every other module uses snake_case. VERIFIED.

**Global uniqueness on tenant-shared rows.** `employees.phone` and `employees.cnic` are unique across the whole platform, because `employees` has no org column. The design is one person record shared by many clinics (INFERRED from `employee_org_location_assignments`).

**Primary keys with no default.** The app must supply these keys. VERIFIED: `document_sequences`, `location_billing_settings` (PK = `location_id`), `number_sequences`, `organization_specialties`, `workflow_effects` (PK = `code`), `transition_effects`, `lab_billing_settings` (PK = `organization_id`), `dental_item_details` / `item_form_responses` (PK = `item_id`), `notification_events` (PK = `code`), `patient_comm_prefs` (PK = `patient_id`), `idempotency_keys`.

**Outdated project docs.** CLAUDE.md calls `invoices` and `inventory` stubs and lists `chairs`, `inventory` and `invoices` as "entity-only". In the code, `invoices` (billing v2) and the inventory module are implemented, and only `chairs` and the single `inventory` table are unregistered. VERIFIED.

