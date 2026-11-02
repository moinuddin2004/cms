import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Doctor compensation (salary / commission) + commission ledger.
 *
 * - compensation_plans (versioned per assignment, no overlaps),
 *   commission_rules, commission_entries (append-only, trigger-enforced),
 *   commission_settlements.
 * - charges: commission snapshot columns.
 * - payroll_records: minor units breakdown; unique per employee × location × month.
 * - Backfill: one SALARY plan per existing assignment from gross_salary
 *   (null → 0, which payroll treats as "no salary" like before), effective
 *   from the assignment's joining date (created_at date as fallback);
 *   payroll breakdown from salary_amount.
 *
 * Dev databases run `synchronize`, which may already have created the
 * tables from the entities; DDL is then skipped and only the trigger and
 * backfills run (both idempotent). Names match what synchronize generates.
 */
export class DoctorCompensation1792403456699 implements MigrationInterface {
  name = 'DoctorCompensation1792403456699';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    if (!(await q.hasTable('compensation_plans'))) await this.createSchema(q);
    await this.createAppendOnlyTrigger(q);
    await this.backfill(q);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Salary changes made through plans go back to the deprecated column.
    await q.query(`
      UPDATE "employee_org_location_assignments" a
         SET "gross_salary" = NULLIF(p."base_salary_minor", 0) / 100.0
        FROM "compensation_plans" p
       WHERE p."assignment_id" = a."id"
         AND p."effective_to" IS NULL
         AND p."base_salary_minor" IS NOT NULL`);
    await q.query(
      `DROP TRIGGER IF EXISTS "trg_commission_entries_append_only" ON "commission_entries"`,
    );
    await q.query(`DROP FUNCTION IF EXISTS commission_entries_append_only()`);

    await q.query(
      `ALTER TABLE "commission_entries" DROP CONSTRAINT "FK_356e13e2f20f98a67d4d85822d4"`,
    );
    await q.query(
      `ALTER TABLE "commission_entries" DROP CONSTRAINT "FK_f90ff083d1652f5d3eaeae9cd0e"`,
    );
    await q.query(
      `ALTER TABLE "commission_entries" DROP CONSTRAINT "FK_6fa5e20c169772d397ceae88b88"`,
    );
    await q.query(
      `ALTER TABLE "commission_settlements" DROP CONSTRAINT "FK_84d2b57fc13fc9e8ad0435cbb3d"`,
    );
    await q.query(
      `ALTER TABLE "commission_settlements" DROP CONSTRAINT "FK_177a0e5d8a76f6e4aac43551eb4"`,
    );
    await q.query(
      `ALTER TABLE "charges" DROP CONSTRAINT "FK_67d4fd3cc25cae22c895468b5a6"`,
    );
    await q.query(
      `ALTER TABLE "charges" DROP CONSTRAINT "FK_28c315421b5a6221072226524bb"`,
    );
    await q.query(
      `ALTER TABLE "compensation_plans" DROP CONSTRAINT "FK_8ca898670affbc4f96c91018ac6"`,
    );
    await q.query(
      `ALTER TABLE "commission_rules" DROP CONSTRAINT "FK_8d682b931fd4a0d34866265c1f8"`,
    );
    await q.query(
      `ALTER TABLE "commission_rules" DROP CONSTRAINT "FK_1086be8827c08d7ab79421d62e0"`,
    );
    await q.query(
      `ALTER TABLE "payroll_records" DROP CONSTRAINT "UQ_ab131112904aaaee42a05a8f42a"`,
    );
    await q.query(
      `ALTER TABLE "charges" DROP CONSTRAINT "chk_charges_commission_rate"`,
    );
    await q.query(`ALTER TABLE "charges" DROP COLUMN "commission_fixed_minor"`);
    await q.query(`ALTER TABLE "charges" DROP COLUMN "commission_rate_bps"`);
    await q.query(`ALTER TABLE "charges" DROP COLUMN "commission_plan_id"`);
    await q.query(
      `ALTER TABLE "charges" DROP COLUMN "performing_assignment_id"`,
    );
    await q.query(`ALTER TABLE "payroll_records" DROP COLUMN "total_minor"`);
    await q.query(
      `ALTER TABLE "payroll_records" DROP COLUMN "commission_minor"`,
    );
    await q.query(
      `ALTER TABLE "payroll_records" DROP COLUMN "base_salary_minor"`,
    );
    await q.query(`DROP TABLE "commission_entries"`);
    await q.query(`DROP TYPE "commission_entries_source_type_enum"`);
    await q.query(`DROP TABLE "commission_settlements"`);
    await q.query(`DROP TYPE "commission_settlements_status_enum"`);
    await q.query(`DROP TABLE "commission_rules"`);
    await q.query(`DROP TYPE "commission_rules_service_category_enum"`);
    await q.query(`DROP TABLE "compensation_plans"`);
    await q.query(`DROP TYPE "compensation_plans_commission_basis_enum"`);
    await q.query(`DROP TYPE "compensation_plans_type_enum"`);
    // Fails if an employee now has payroll at two locations in one month;
    // remove or merge those records before reverting.
    await q.query(
      `ALTER TABLE "payroll_records" ADD CONSTRAINT "UQ_2523104f5789ef00c1e9dbf98fa" UNIQUE ("employee_id", "month", "year")`,
    );
  }

  private async createSchema(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "payroll_records" DROP CONSTRAINT IF EXISTS "UQ_2523104f5789ef00c1e9dbf98fa"`,
    );

    await q.query(
      `CREATE TYPE "compensation_plans_type_enum" AS ENUM('SALARY', 'COMMISSION', 'SALARY_PLUS_COMMISSION')`,
    );
    await q.query(
      `CREATE TYPE "compensation_plans_commission_basis_enum" AS ENUM('NET', 'GROSS')`,
    );
    await q.query(`CREATE TABLE "compensation_plans" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "organization_id" uuid NOT NULL,
      "assignment_id" uuid NOT NULL,
      "type" "compensation_plans_type_enum" NOT NULL,
      "base_salary_minor" bigint,
      "default_rate_bps" integer,
      "commission_basis" "compensation_plans_commission_basis_enum" NOT NULL DEFAULT 'NET',
      "effective_from" date NOT NULL,
      "effective_to" date,
      "created_by" uuid,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "chk_compensation_plans_dates" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
      CONSTRAINT "chk_compensation_plans_salary" CHECK ("base_salary_minor" IS NULL OR "base_salary_minor" >= 0),
      CONSTRAINT "chk_compensation_plans_rate" CHECK ("default_rate_bps" IS NULL OR "default_rate_bps" BETWEEN 0 AND 10000),
      CONSTRAINT "chk_compensation_plans_fields" CHECK (("type" = 'SALARY' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NULL)
   OR ("type" = 'COMMISSION' AND "default_rate_bps" IS NOT NULL AND "base_salary_minor" IS NULL)
   OR ("type" = 'SALARY_PLUS_COMMISSION' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NOT NULL)),
      CONSTRAINT "excl_compensation_plans_overlap" EXCLUDE USING gist ("assignment_id" WITH =, daterange("effective_from", "effective_to", '[]') WITH &&),
      CONSTRAINT "PK_04b9990665545ed3e60b19d19e8" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_compensation_plans_assignment" ON "compensation_plans" ("assignment_id", "effective_from")`,
    );

    await q.query(
      `CREATE TYPE "commission_rules_service_category_enum" AS ENUM('CONSULTATION', 'PROCEDURE', 'OTHER')`,
    );
    await q.query(`CREATE TABLE "commission_rules" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "plan_id" uuid NOT NULL,
      "service_id" uuid,
      "service_category" "commission_rules_service_category_enum",
      "rate_bps" integer,
      "fixed_amount_minor" bigint,
      CONSTRAINT "chk_commission_rules_target" CHECK (("service_id" IS NULL) <> ("service_category" IS NULL)),
      CONSTRAINT "chk_commission_rules_fixed" CHECK ("fixed_amount_minor" IS NULL OR "fixed_amount_minor" >= 0),
      CONSTRAINT "chk_commission_rules_rate" CHECK ("rate_bps" IS NULL OR "rate_bps" BETWEEN 0 AND 10000),
      CONSTRAINT "chk_commission_rules_amount" CHECK (("rate_bps" IS NULL) <> ("fixed_amount_minor" IS NULL)),
      CONSTRAINT "PK_399c9fa57f7fd28dfc57acea3bd" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE UNIQUE INDEX "uq_commission_rules_category" ON "commission_rules" ("plan_id", "service_category") WHERE "service_category" IS NOT NULL`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "uq_commission_rules_service" ON "commission_rules" ("plan_id", "service_id") WHERE "service_id" IS NOT NULL`,
    );

    await q.query(
      `CREATE TYPE "commission_settlements_status_enum" AS ENUM('PENDING', 'PAID')`,
    );
    await q.query(`CREATE TABLE "commission_settlements" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "organization_id" uuid NOT NULL,
      "location_id" uuid NOT NULL,
      "assignment_id" uuid NOT NULL,
      "period_start" date NOT NULL,
      "period_end" date NOT NULL,
      "total_minor" bigint NOT NULL DEFAULT '0',
      "status" "commission_settlements_status_enum" NOT NULL DEFAULT 'PENDING',
      "payroll_record_id" uuid,
      "paid_at" TIMESTAMP WITH TIME ZONE,
      "paid_by" uuid,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "REL_84d2b57fc13fc9e8ad0435cbb3" UNIQUE ("payroll_record_id"),
      CONSTRAINT "PK_3f56beb7eca5353e6e11f98a2dc" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_commission_settlements_assignment" ON "commission_settlements" ("assignment_id", "period_end")`,
    );

    await q.query(
      `CREATE TYPE "commission_entries_source_type_enum" AS ENUM('ALLOCATION', 'UNAPPLY', 'CHARGE_ADJUST', 'VOID', 'MANUAL')`,
    );
    await q.query(`CREATE TABLE "commission_entries" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "organization_id" uuid NOT NULL,
      "location_id" uuid NOT NULL,
      "assignment_id" uuid NOT NULL,
      "charge_id" uuid NOT NULL,
      "source_type" "commission_entries_source_type_enum" NOT NULL,
      "source_id" uuid NOT NULL,
      "base_minor" bigint NOT NULL DEFAULT '0',
      "rate_bps" integer,
      "amount_minor" bigint NOT NULL DEFAULT '0',
      "settlement_id" uuid,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_35b5372834c1af9e381d1bd2f97" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX "idx_commission_entries_charge" ON "commission_entries" ("charge_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_commission_entries_unsettled" ON "commission_entries" ("assignment_id") WHERE "settlement_id" IS NULL`,
    );
    await q.query(
      `CREATE INDEX "idx_commission_entries_assignment" ON "commission_entries" ("assignment_id", "created_at")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "uq_commission_entries_source" ON "commission_entries" ("source_type", "source_id", "charge_id")`,
    );

    await q.query(
      `ALTER TABLE "payroll_records" ADD "base_salary_minor" bigint NOT NULL DEFAULT '0'`,
    );
    await q.query(
      `ALTER TABLE "payroll_records" ADD "commission_minor" bigint NOT NULL DEFAULT '0'`,
    );
    await q.query(
      `ALTER TABLE "payroll_records" ADD "total_minor" bigint NOT NULL DEFAULT '0'`,
    );
    await q.query(`ALTER TABLE "charges" ADD "performing_assignment_id" uuid`);
    await q.query(`ALTER TABLE "charges" ADD "commission_plan_id" uuid`);
    await q.query(`ALTER TABLE "charges" ADD "commission_rate_bps" integer`);
    await q.query(`ALTER TABLE "charges" ADD "commission_fixed_minor" bigint`);
    await q.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "chk_charges_commission_rate" CHECK ("commission_rate_bps" IS NULL OR "commission_rate_bps" BETWEEN 0 AND 10000)`,
    );
    await q.query(
      `ALTER TABLE "payroll_records" ADD CONSTRAINT "UQ_ab131112904aaaee42a05a8f42a" UNIQUE ("employee_id", "location_id", "month", "year")`,
    );

    await q.query(
      `ALTER TABLE "commission_rules" ADD CONSTRAINT "FK_1086be8827c08d7ab79421d62e0" FOREIGN KEY ("plan_id") REFERENCES "compensation_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "commission_rules" ADD CONSTRAINT "FK_8d682b931fd4a0d34866265c1f8" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "compensation_plans" ADD CONSTRAINT "FK_8ca898670affbc4f96c91018ac6" FOREIGN KEY ("assignment_id") REFERENCES "employee_org_location_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "FK_28c315421b5a6221072226524bb" FOREIGN KEY ("performing_assignment_id") REFERENCES "employee_org_location_assignments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "FK_67d4fd3cc25cae22c895468b5a6" FOREIGN KEY ("commission_plan_id") REFERENCES "compensation_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "commission_settlements" ADD CONSTRAINT "FK_177a0e5d8a76f6e4aac43551eb4" FOREIGN KEY ("assignment_id") REFERENCES "employee_org_location_assignments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "commission_settlements" ADD CONSTRAINT "FK_84d2b57fc13fc9e8ad0435cbb3d" FOREIGN KEY ("payroll_record_id") REFERENCES "payroll_records"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "commission_entries" ADD CONSTRAINT "FK_6fa5e20c169772d397ceae88b88" FOREIGN KEY ("assignment_id") REFERENCES "employee_org_location_assignments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "commission_entries" ADD CONSTRAINT "FK_f90ff083d1652f5d3eaeae9cd0e" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "commission_entries" ADD CONSTRAINT "FK_356e13e2f20f98a67d4d85822d4" FOREIGN KEY ("settlement_id") REFERENCES "commission_settlements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  /**
   * No DELETE; no UPDATE except settlement_id: set once (null → id), or
   * released to null while that settlement is still PENDING.
   */
  private async createAppendOnlyTrigger(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION commission_entries_append_only() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'commission_entries is append-only: delete refused';
        END IF;
        IF OLD.settlement_id IS NOT NULL
           AND NEW.settlement_id IS DISTINCT FROM OLD.settlement_id THEN
          -- Only release (back to NULL) from a settlement not paid yet,
          -- i.e. its payroll record was deleted before payment.
          IF NEW.settlement_id IS NOT NULL OR EXISTS (
               SELECT 1 FROM commission_settlements s
                WHERE s.id = OLD.settlement_id AND s.status <> 'PENDING') THEN
            RAISE EXCEPTION 'commission entry % is already settled', OLD.id;
          END IF;
        END IF;
        IF (NEW.id, NEW.organization_id, NEW.location_id, NEW.assignment_id,
            NEW.charge_id, NEW.source_type, NEW.source_id, NEW.base_minor,
            NEW.rate_bps, NEW.amount_minor, NEW.created_at)
           IS DISTINCT FROM
           (OLD.id, OLD.organization_id, OLD.location_id, OLD.assignment_id,
            OLD.charge_id, OLD.source_type, OLD.source_id, OLD.base_minor,
            OLD.rate_bps, OLD.amount_minor, OLD.created_at) THEN
          RAISE EXCEPTION 'commission_entries is append-only: only settlement_id may change';
        END IF;
        RETURN NEW;
      END
      $$`);
    await q.query(
      `DROP TRIGGER IF EXISTS "trg_commission_entries_append_only" ON "commission_entries"`,
    );
    await q.query(`
      CREATE TRIGGER "trg_commission_entries_append_only"
      BEFORE UPDATE OR DELETE ON "commission_entries"
      FOR EACH ROW EXECUTE FUNCTION commission_entries_append_only()`);
  }

  private async backfill(q: QueryRunner): Promise<void> {
    await q.query(`
      INSERT INTO "compensation_plans"
        ("organization_id", "assignment_id", "type", "base_salary_minor",
         "commission_basis", "effective_from")
      SELECT a."organization_id", a."id", 'SALARY',
             ROUND(COALESCE(a."gross_salary", 0) * 100)::bigint, 'NET',
             COALESCE(a."joining_date", a."created_at"::date)
        FROM "employee_org_location_assignments" a
       WHERE NOT EXISTS (
         SELECT 1 FROM "compensation_plans" p WHERE p."assignment_id" = a."id")`);
    await q.query(`
      UPDATE "payroll_records"
         SET "base_salary_minor" = ROUND("salary_amount" * 100)::bigint,
             "commission_minor" = 0,
             "total_minor" = ROUND("salary_amount" * 100)::bigint
       WHERE "total_minor" = 0 AND "salary_amount" <> 0`);
  }
}
