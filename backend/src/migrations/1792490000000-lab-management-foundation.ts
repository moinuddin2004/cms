import { MigrationInterface, QueryRunner } from 'typeorm';
import { UUID_V7_FUNCTION_SQL } from '../common/database/uuid-v7';

/**
 * Lab management, Sprint 1 (lab ERD §1, §4, §7, §8):
 *
 * - `uuid_generate_v7()` — primary-key default of the new tables.
 * - Support: `audit_logs`, `status_history` (append-only, trigger-enforced),
 *   `number_sequences`. (`idempotency_keys` already exists from the queue.)
 * - Lab directory: `labs`, `lab_members`, `lab_clinic_links`.
 *
 * Dev databases run `synchronize`, which may already have created the
 * tables from the entities; each table's DDL is then skipped and only the
 * function and triggers run (both idempotent). Names match what synchronize
 * generates, so both paths end in the same schema.
 */
export class LabManagementFoundation1792490000000
  implements MigrationInterface
{
  name = 'LabManagementFoundation1792490000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(UUID_V7_FUNCTION_SQL);
    if (!(await q.hasTable('audit_logs'))) await this.createAuditLogs(q);
    if (!(await q.hasTable('status_history')))
      await this.createStatusHistory(q);
    if (!(await q.hasTable('number_sequences')))
      await this.createNumberSequences(q);
    if (!(await q.hasTable('labs'))) await this.createLabs(q);
    if (!(await q.hasTable('lab_members'))) await this.createLabMembers(q);
    if (!(await q.hasTable('lab_clinic_links')))
      await this.createLabClinicLinks(q);
    await this.createAppendOnlyTriggers(q);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of ['audit_logs', 'status_history']) {
      await q.query(
        `DROP TRIGGER IF EXISTS "trg_${table}_append_only" ON "${table}"`,
      );
    }
    await q.query(`DROP FUNCTION IF EXISTS reject_append_only_mutation()`);

    await q.query(`DROP TABLE "lab_clinic_links"`);
    await q.query(`DROP TYPE "lab_clinic_links_patient_data_level_enum"`);
    await q.query(`DROP TYPE "lab_clinic_links_status_enum"`);
    await q.query(`DROP TABLE "lab_members"`);
    await q.query(`DROP TYPE "lab_members_role_enum"`);
    await q.query(`DROP TABLE "labs"`);
    await q.query(`DROP TYPE "labs_status_enum"`);
    await q.query(`DROP TYPE "labs_lab_type_enum"`);
    await q.query(`DROP TABLE "number_sequences"`);
    await q.query(`DROP TABLE "status_history"`);
    await q.query(`DROP TYPE "status_history_via_enum"`);
    await q.query(`DROP TYPE "status_history_actor_side_enum"`);
    await q.query(`DROP TABLE "audit_logs"`);
    await q.query(`DROP TYPE "audit_logs_actor_side_enum"`);
    await q.query(`DROP TYPE "audit_logs_action_enum"`);
    // uuid_generate_v7() stays: other tables may use it by then.
  }

  private async createAuditLogs(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "audit_logs_action_enum" AS ENUM('create', 'update', 'void', 'export', 'view_sensitive')`,
    );
    await q.query(
      `CREATE TYPE "audit_logs_actor_side_enum" AS ENUM('clinic', 'lab', 'platform', 'system')`,
    );
    await q.query(`CREATE TABLE "audit_logs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
      "organization_id" uuid,
      "entity_type" character varying(50) NOT NULL,
      "entity_id" uuid NOT NULL,
      "action" "audit_logs_action_enum" NOT NULL,
      "changes" jsonb,
      "actor_user_id" uuid,
      "actor_side" "audit_logs_actor_side_enum" NOT NULL,
      "ip" inet,
      "request_id" character varying(100),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id", "created_at")`,
    );
    await q.query(
      `CREATE INDEX "idx_audit_logs_org_created" ON "audit_logs" ("organization_id", "created_at")`,
    );
  }

  private async createStatusHistory(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "status_history_actor_side_enum" AS ENUM('clinic', 'lab', 'platform', 'system')`,
    );
    await q.query(
      `CREATE TYPE "status_history_via_enum" AS ENUM('app', 'portal', 'magic_link', 'proxy', 'qr')`,
    );
    await q.query(`CREATE TABLE "status_history" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
      "organization_id" uuid NOT NULL,
      "entity_type" character varying(50) NOT NULL,
      "entity_id" uuid NOT NULL,
      "from_state" character varying(50),
      "to_state" character varying(50) NOT NULL,
      "action_code" character varying(50) NOT NULL,
      "actor_user_id" uuid,
      "actor_side" "status_history_actor_side_enum" NOT NULL,
      "via" "status_history_via_enum" NOT NULL DEFAULT 'app',
      "on_behalf_of_lab_id" uuid,
      "reason" text,
      "metadata" jsonb,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_271a5228edb4eeb41bc01d58fac" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_status_history_entity" ON "status_history" ("entity_type", "entity_id", "created_at")`,
    );
  }

  private async createNumberSequences(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "number_sequences" (
      "organization_id" uuid NOT NULL,
      "sequence_key" character varying(30) NOT NULL,
      "prefix" character varying(10) NOT NULL,
      "next_value" bigint NOT NULL DEFAULT '1',
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "chk_number_sequences_next_value" CHECK ("next_value" > 0),
      CONSTRAINT "PK_94ba8893a2ea514dcef2fb5646e" PRIMARY KEY ("organization_id", "sequence_key"))`);
  }

  private async createLabs(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "labs_lab_type_enum" AS ENUM('external', 'internal')`,
    );
    await q.query(
      `CREATE TYPE "labs_status_enum" AS ENUM('active', 'suspended')`,
    );
    await q.query(`CREATE TABLE "labs" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
      "lab_type" "labs_lab_type_enum" NOT NULL,
      "owner_organization_id" uuid,
      "name" character varying(150) NOT NULL,
      "phone" character varying(20),
      "whatsapp_phone" character varying(20),
      "email" character varying(255),
      "city" character varying(100),
      "address" text,
      "status" "labs_status_enum" NOT NULL DEFAULT 'active',
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "created_by" uuid,
      "updated_by" uuid,
      "version" integer NOT NULL DEFAULT 1,
      CONSTRAINT "chk_labs_owner" CHECK (("lab_type" = 'internal') = ("owner_organization_id" IS NOT NULL)),
      CONSTRAINT "PK_6b9d28c1591cef294c224ce31aa" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_labs_status_name" ON "labs" ("status", "name")`,
    );
    await q.query(
      `CREATE INDEX "idx_labs_owner" ON "labs" ("owner_organization_id")`,
    );
    await q.query(
      `ALTER TABLE "labs" ADD CONSTRAINT "FK_93d5630dcf7aa188aa81d12d42a" FOREIGN KEY ("owner_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  private async createLabMembers(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "lab_members_role_enum" AS ENUM('lab_admin', 'lab_technician')`,
    );
    await q.query(`CREATE TABLE "lab_members" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
      "lab_id" uuid NOT NULL,
      "user_id" uuid NOT NULL,
      "role" "lab_members_role_enum" NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "created_by" uuid,
      "updated_by" uuid,
      "version" integer NOT NULL DEFAULT 1,
      CONSTRAINT "uq_lab_members_lab_user" UNIQUE ("lab_id", "user_id"),
      CONSTRAINT "PK_e0d41bc12dbc74880bc38c63c4c" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_lab_members_user" ON "lab_members" ("user_id")`,
    );
    await q.query(
      `ALTER TABLE "lab_members" ADD CONSTRAINT "FK_85cb54a1ab4aa9c5949f005de48" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "lab_members" ADD CONSTRAINT "FK_3d2352e25e44b538a5ca9808dab" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  private async createLabClinicLinks(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "lab_clinic_links_status_enum" AS ENUM('invited', 'active', 'suspended')`,
    );
    await q.query(
      `CREATE TYPE "lab_clinic_links_patient_data_level_enum" AS ENUM('full_name', 'code_only')`,
    );
    await q.query(`CREATE TABLE "lab_clinic_links" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v7(),
      "lab_id" uuid NOT NULL,
      "organization_id" uuid NOT NULL,
      "status" "lab_clinic_links_status_enum" NOT NULL DEFAULT 'invited',
      "payment_terms_days" integer NOT NULL DEFAULT 30,
      "patient_data_level" "lab_clinic_links_patient_data_level_enum" NOT NULL DEFAULT 'full_name',
      "activated_at" TIMESTAMP WITH TIME ZONE,
      "notes" text,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "created_by" uuid,
      "updated_by" uuid,
      "version" integer NOT NULL DEFAULT 1,
      CONSTRAINT "uq_lab_clinic_links_lab_org" UNIQUE ("lab_id", "organization_id"),
      CONSTRAINT "chk_lab_clinic_links_terms" CHECK ("payment_terms_days" BETWEEN 0 AND 365),
      CONSTRAINT "PK_f4995746b2eb9b5a4ea317157e4" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_lab_clinic_links_org_status" ON "lab_clinic_links" ("organization_id", "status")`,
    );
    await q.query(
      `ALTER TABLE "lab_clinic_links" ADD CONSTRAINT "FK_f0cfb2cf8b56c0f20ddb2fd461e" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "lab_clinic_links" ADD CONSTRAINT "FK_9381db856d58c7708dde17e2223" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  /** History is evidence: rows are only ever inserted (lab ERD §8). */
  private async createAppendOnlyTriggers(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION reject_append_only_mutation() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
          USING ERRCODE = 'restrict_violation';
      END
      $$`);
    for (const table of ['audit_logs', 'status_history']) {
      await q.query(
        `DROP TRIGGER IF EXISTS "trg_${table}_append_only" ON "${table}"`,
      );
      await q.query(
        `CREATE TRIGGER "trg_${table}_append_only" BEFORE UPDATE OR DELETE ON "${table}"
         FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation()`,
      );
    }
  }
}
