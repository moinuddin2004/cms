import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTable1776356529788 implements MigrationInterface {
  name = 'CreateTable1776356529788';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_global_role_enum" AS ENUM('super_admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "name" character varying(255), "phone" character varying(20), "avatar_url" character varying(500), "password" character varying(255), "password_reset_token" character varying, "password_reset_expires" TIMESTAMP WITH TIME ZONE, "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'local', "refresh_token" character varying, "global_role" "public"."users_global_role_enum", "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "last_accessed_organization_id" uuid, "last_accessed_location_id" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, "suspended_at" TIMESTAMP WITH TIME ZONE, "suspension_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_951b8f1dfc94ac1d0301a14b7e1" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON "users" ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organizations_subscription_plan_enum" AS ENUM('free', 'starter', 'professional', 'enterprise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "email" character varying(255), "phone" character varying(20), "website" character varying(500), "subscription_plan" "public"."organizations_subscription_plan_enum" NOT NULL DEFAULT 'free', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a3d861e393299a217b9fc05dd4" ON "organizations" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_963693341bd612aa01ddf3a4b6" ON "organizations" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patient_id" character varying(20) NOT NULL, "organization_id" uuid NOT NULL, "user_id" uuid, "full_name" character varying(255) NOT NULL, "phone" character varying(20) NOT NULL, "dob" date, "gender" "public"."patients_gender_enum", "blood_group" "public"."patients_blood_group_enum", "email" character varying(255), "address" text, "city" character varying(100), "medical_history" text, "allergies" jsonb NOT NULL DEFAULT '[]', "emergency_name" character varying(255), "emergency_phone" character varying(20), "emergency_relation" character varying(100), "referred_by" character varying(255), "occupation" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1dc2db3a63a0bf2388fbfee86b1" UNIQUE ("patient_id"), CONSTRAINT "UQ_8e8e6b29f954d02d0cf410dbaff" UNIQUE ("phone"), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9facec8f04ca77541396ec582e" ON "patients" ("organization_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e23017f3b56fa3ee6611392c4" ON "patients" ("full_name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_61e4e6a8a7507c253dfb2eddbf" ON "patients" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8e8e6b29f954d02d0cf410dbaf" ON "patients" ("phone") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1dc2db3a63a0bf2388fbfee86b" ON "patients" ("patient_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "code" character varying(50) NOT NULL, "address" text, "city" character varying(100), "state" character varying(100), "postal_code" character varying(20), "country" character varying(100), "phone" character varying(20), "email" character varying(255), "timezone" character varying(100) NOT NULL DEFAULT 'UTC', "currency" character varying(10) NOT NULL DEFAULT 'USD', "manager_id" uuid, "operating_hours" jsonb, "capacity_per_day" integer, "total_chairs" integer NOT NULL DEFAULT '1', "is_main_branch" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7cc1c9e3853b94816c094825e74" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_05e1afa2c4dd2e3784200b499b" ON "locations" ("organization_id", "code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_311e41074a7aa37e276e93c484" ON "locations" ("organization_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE TABLE "patient_visits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patient_id" uuid NOT NULL, "location_id" uuid NOT NULL, "first_visit_date" TIMESTAMP WITH TIME ZONE, "last_visit_date" TIMESTAMP WITH TIME ZONE, "visit_count" integer NOT NULL DEFAULT '0', "preferred" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6a450715fd0f4159a9bfaa29c63" UNIQUE ("patient_id", "location_id"), CONSTRAINT "PK_5b5111a9f4a0922fb2a7d1f8e00" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a450715fd0f4159a9bfaa29c6" ON "patient_visits" ("patient_id", "location_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "user_agent" text, "device" character varying(255), "browser" character varying(100), "os" character varying(100), "ip_address" character varying(45), "location" character varying(255), "is_current" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "last_active_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fe5c2a28cde7668fd49a3e51128" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ead56a334d703fe8605f173b44" ON "user_sessions" ("user_id", "is_revoked") `,
    );
    await queryRunner.query(
      `CREATE TABLE "security_logs" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "event_type" "public"."security_logs_event_type_enum" NOT NULL, "ip_address" character varying(45), "user_agent" text, "metadata" jsonb NOT NULL DEFAULT '{}', "session_id" uuid, "success" boolean NOT NULL DEFAULT true, "error_message" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_468d8d14352bbc114df498ab3db" PRIMARY KEY ("uuid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4bbd742cc4520d66a4378998b" ON "security_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31abffa0dcd252c7ef1513692e" ON "security_logs" ("user_id", "event_type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_admins_role_enum" AS ENUM('admin', 'billing_admin', 'support_admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_admins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "role" "public"."organization_admins_role_enum" NOT NULL DEFAULT 'admin', "can_manage_locations" boolean NOT NULL DEFAULT true, "can_manage_users" boolean NOT NULL DEFAULT true, "can_view_billing" boolean NOT NULL DEFAULT true, "can_manage_settings" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7f742350e3290ecef7c8c87b008" UNIQUE ("user_id", "organization_id"), CONSTRAINT "PK_9ea816dc8d3d9513b29f36aff9c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f742350e3290ecef7c8c87b00" ON "organization_admins" ("user_id", "organization_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "location_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "location_id" uuid NOT NULL, "appointment_slot_duration" integer NOT NULL DEFAULT '30', "max_appointments_per_day" integer NOT NULL DEFAULT '50', "advance_booking_days" integer NOT NULL DEFAULT '30', "cancellation_notice_hours" integer NOT NULL DEFAULT '24', "reminder_enabled" boolean NOT NULL DEFAULT true, "reminder_days_before" integer NOT NULL DEFAULT '1', "reminder_hours_before" integer NOT NULL DEFAULT '2', "reminder_channels" jsonb NOT NULL DEFAULT '["email"]', "payment_gateway" character varying(50), "tax_rate" numeric(5,2) NOT NULL DEFAULT '0', "late_fee_percentage" numeric(5,2) NOT NULL DEFAULT '0', "logo_url" character varying(500), "primary_color" character varying(20), "theme" character varying(20) NOT NULL DEFAULT 'light', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_84d2853faad00c6eebb7cd6e8c0" UNIQUE ("location_id"), CONSTRAINT "REL_84d2853faad00c6eebb7cd6e8c" UNIQUE ("location_id"), CONSTRAINT "PK_97e7aec47099f1190e9468f0007" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_84d2853faad00c6eebb7cd6e8c" ON "location_settings" ("location_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_locations_role_at_location_enum" AS ENUM('dentist', 'receptionist', 'assistant', 'manager', 'admin', 'hygienist')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "location_id" uuid NOT NULL, "role_at_location" "public"."user_locations_role_at_location_enum" NOT NULL DEFAULT 'receptionist', "can_view_appointments" boolean NOT NULL DEFAULT true, "can_create_appointments" boolean NOT NULL DEFAULT true, "can_manage_staff" boolean NOT NULL DEFAULT false, "can_view_finance" boolean NOT NULL DEFAULT false, "is_primary" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_aac5bef9251764c6f9efc0bab40" UNIQUE ("user_id", "location_id"), CONSTRAINT "PK_4afd5dae13173e88183db3cd210" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18a8a4ecb4872c32df9d35d506" ON "user_locations" ("user_id", "organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aac5bef9251764c6f9efc0bab4" ON "user_locations" ("user_id", "location_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "location_id" uuid NOT NULL, "user_id" uuid NOT NULL, "designation" character varying(100), "specialization" character varying(200), "experience_years" integer, "joining_date" date, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d83c53c3e553a48dadb9722e3" ON "employees" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1707d2eb2fdad51a555eb98fed" ON "employees" ("location_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE TABLE "employee_schedules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "location_id" uuid NOT NULL, "day_of_week" integer NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "slot_duration" integer NOT NULL DEFAULT '30', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a82f7aa2134e860b889d1cf78b3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cae77accf4b741c197b6d0df3" ON "employee_schedules" ("employee_id", "location_id", "day_of_week") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chairs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "location_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "code" character varying(20) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6f8b173103272b8ac5a9932382c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a104d3b270dd88b0cbfd230bba" ON "chairs" ("location_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."appointments_type_enum" AS ENUM('consultation', 'follow_up', 'treatment', 'checkup')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."appointments_status_enum" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "location_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "employee_id" uuid, "chair_id" uuid, "title" character varying(255), "type" "public"."appointments_type_enum" NOT NULL DEFAULT 'consultation', "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'scheduled', "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE NOT NULL, "duration_minutes" integer NOT NULL DEFAULT '30', "is_walk_in" boolean NOT NULL DEFAULT false, "notes" text, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3007a47d97a542e63b3308a69b" ON "appointments" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4e3a19c74dac65a223368fa9a" ON "appointments" ("employee_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3330f054416745deaa2cc13070" ON "appointments" ("patient_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6766cb4aab4ff80c6c95e2d2fa" ON "appointments" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29a60750f63d56836fd159974f" ON "appointments" ("location_id", "start_time") `,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid, "location_id" uuid NOT NULL, "item_name" character varying(255) NOT NULL, "quantity" integer NOT NULL DEFAULT '0', "unit_price" numeric(10,2) NOT NULL DEFAULT '0', "expiry_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_82aa5da437c5bbfb80703b08309" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fc4672e0c04a072ff00651452" ON "inventory" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1eea99c8c645d7541002473a01" ON "inventory" ("location_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoices_status_enum" AS ENUM('draft', 'sent', 'paid', 'overdue')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid, "location_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "appointment_id" uuid, "amount" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."invoices_status_enum" NOT NULL DEFAULT 'draft', "due_date" date, "payment_date" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac0f09364e3701d9ed35435288" ON "invoices" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e3be0c11f4ce66b9b352477cb0" ON "invoices" ("patient_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d4e095bcd100de447d3c27708f" ON "invoices" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c73e55077d4e1dffe4af52e263" ON "invoices" ("location_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "super_admin_access_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "admin_user_id" uuid NOT NULL, "accessed_organization_id" uuid, "accessed_location_id" uuid, "action" character varying(100) NOT NULL, "resource_type" character varying(100), "resource_id" uuid, "ip_address" character varying(45), "user_agent" text, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bc55f063dc43499afd59accc0e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad0bba1a8799da5042732035b6" ON "super_admin_access_log" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9091a02bb180b9ab7956f26e31" ON "super_admin_access_log" ("accessed_organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_516991f2c103172b5cb7890b06" ON "super_admin_access_log" ("admin_user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "FK_231c2a4693ed4edb7ccf29d9111" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "locations" ADD CONSTRAINT "FK_e80aa366acb3dbc300e668c3ee2" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_visits" ADD CONSTRAINT "FK_906db448e7af552e4b036ca8a54" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_visits" ADD CONSTRAINT "FK_1b1d71c9d1d47ee745fe6b6aba3" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_logs" ADD CONSTRAINT "FK_3fc41b4fda367506672e9030ad0" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" ADD CONSTRAINT "FK_36fd0c8cafb32489dd25f5f6414" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" ADD CONSTRAINT "FK_ed5e20cd396ace01074fa66b1bf" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "location_settings" ADD CONSTRAINT "FK_84d2853faad00c6eebb7cd6e8c0" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_locations" ADD CONSTRAINT "FK_437edca703095b237b5bdb35e22" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_locations" ADD CONSTRAINT "FK_029065dae6c0fb726ff3cf327bc" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_locations" ADD CONSTRAINT "FK_3f495c9a559977dbbc1901a143e" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_0a20efaa3d1b8c73427c3e68dfa" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedules" ADD CONSTRAINT "FK_e02e3472a9443d6fd21e7b3932b" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedules" ADD CONSTRAINT "FK_9ae931e9df77875b0eca4fce6c5" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chairs" ADD CONSTRAINT "FK_d79e592d98f947e354c7a840e64" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_6766cb4aab4ff80c6c95e2d2fa9" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_24dcc9d49a334fdb948cd5efed3" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_3330f054416745deaa2cc130700" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_f4e3a19c74dac65a223368fa9a0" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_1657f2c5de723fe929ee3546010" FOREIGN KEY ("chair_id") REFERENCES "chairs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD CONSTRAINT "FK_4fc4672e0c04a072ff006514525" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD CONSTRAINT "FK_1eea99c8c645d7541002473a015" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_d4e095bcd100de447d3c27708f9" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_c73e55077d4e1dffe4af52e263e" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_e3be0c11f4ce66b9b352477cb06" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_70757267b44d3b26bd88966908b" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_admin_access_log" ADD CONSTRAINT "FK_516991f2c103172b5cb7890b06f" FOREIGN KEY ("admin_user_id") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "super_admin_access_log" DROP CONSTRAINT "FK_516991f2c103172b5cb7890b06f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_70757267b44d3b26bd88966908b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_e3be0c11f4ce66b9b352477cb06"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_c73e55077d4e1dffe4af52e263e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_d4e095bcd100de447d3c27708f9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" DROP CONSTRAINT "FK_1eea99c8c645d7541002473a015"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" DROP CONSTRAINT "FK_4fc4672e0c04a072ff006514525"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_1657f2c5de723fe929ee3546010"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_f4e3a19c74dac65a223368fa9a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_3330f054416745deaa2cc130700"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_24dcc9d49a334fdb948cd5efed3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_6766cb4aab4ff80c6c95e2d2fa9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chairs" DROP CONSTRAINT "FK_d79e592d98f947e354c7a840e64"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedules" DROP CONSTRAINT "FK_9ae931e9df77875b0eca4fce6c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee_schedules" DROP CONSTRAINT "FK_e02e3472a9443d6fd21e7b3932b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_0a20efaa3d1b8c73427c3e68dfa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_locations" DROP CONSTRAINT "FK_3f495c9a559977dbbc1901a143e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_locations" DROP CONSTRAINT "FK_029065dae6c0fb726ff3cf327bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_locations" DROP CONSTRAINT "FK_437edca703095b237b5bdb35e22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "location_settings" DROP CONSTRAINT "FK_84d2853faad00c6eebb7cd6e8c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" DROP CONSTRAINT "FK_ed5e20cd396ace01074fa66b1bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" DROP CONSTRAINT "FK_36fd0c8cafb32489dd25f5f6414"`,
    );
    await queryRunner.query(
      `ALTER TABLE "security_logs" DROP CONSTRAINT "FK_3fc41b4fda367506672e9030ad0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_visits" DROP CONSTRAINT "FK_1b1d71c9d1d47ee745fe6b6aba3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_visits" DROP CONSTRAINT "FK_906db448e7af552e4b036ca8a54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "locations" DROP CONSTRAINT "FK_e80aa366acb3dbc300e668c3ee2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP CONSTRAINT "FK_231c2a4693ed4edb7ccf29d9111"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_516991f2c103172b5cb7890b06"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9091a02bb180b9ab7956f26e31"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad0bba1a8799da5042732035b6"`,
    );
    await queryRunner.query(`DROP TABLE "super_admin_access_log"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c73e55077d4e1dffe4af52e263"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d4e095bcd100de447d3c27708f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e3be0c11f4ce66b9b352477cb0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac0f09364e3701d9ed35435288"`,
    );
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TYPE "public"."invoices_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1eea99c8c645d7541002473a01"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4fc4672e0c04a072ff00651452"`,
    );
    await queryRunner.query(`DROP TABLE "inventory"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_29a60750f63d56836fd159974f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6766cb4aab4ff80c6c95e2d2fa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3330f054416745deaa2cc13070"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f4e3a19c74dac65a223368fa9a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3007a47d97a542e63b3308a69b"`,
    );
    await queryRunner.query(`DROP TABLE "appointments"`);
    await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."appointments_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a104d3b270dd88b0cbfd230bba"`,
    );
    await queryRunner.query(`DROP TABLE "chairs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2cae77accf4b741c197b6d0df3"`,
    );
    await queryRunner.query(`DROP TABLE "employee_schedules"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1707d2eb2fdad51a555eb98fed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d83c53c3e553a48dadb9722e3"`,
    );
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aac5bef9251764c6f9efc0bab4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18a8a4ecb4872c32df9d35d506"`,
    );
    await queryRunner.query(`DROP TABLE "user_locations"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_locations_role_at_location_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_84d2853faad00c6eebb7cd6e8c"`,
    );
    await queryRunner.query(`DROP TABLE "location_settings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7f742350e3290ecef7c8c87b00"`,
    );
    await queryRunner.query(`DROP TABLE "organization_admins"`);
    await queryRunner.query(
      `DROP TYPE "public"."organization_admins_role_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31abffa0dcd252c7ef1513692e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b4bbd742cc4520d66a4378998b"`,
    );
    await queryRunner.query(`DROP TABLE "security_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ead56a334d703fe8605f173b44"`,
    );
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a450715fd0f4159a9bfaa29c6"`,
    );
    await queryRunner.query(`DROP TABLE "patient_visits"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_311e41074a7aa37e276e93c484"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_05e1afa2c4dd2e3784200b499b"`,
    );
    await queryRunner.query(`DROP TABLE "locations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1dc2db3a63a0bf2388fbfee86b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8e8e6b29f954d02d0cf410dbaf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_61e4e6a8a7507c253dfb2eddbf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e23017f3b56fa3ee6611392c4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9facec8f04ca77541396ec582e"`,
    );
    await queryRunner.query(`DROP TABLE "patients"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_963693341bd612aa01ddf3a4b6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a3d861e393299a217b9fc05dd4"`,
    );
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(
      `DROP TYPE "public"."organizations_subscription_plan_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3676155292d72c67cd4e090514"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_global_role_enum"`);
  }
}
