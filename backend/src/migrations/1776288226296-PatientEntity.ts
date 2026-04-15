import { MigrationInterface, QueryRunner } from "typeorm";

export class PatientEntity1776288226296 implements MigrationInterface {
    name = 'PatientEntity1776288226296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_provider_enum" AS ENUM('google', 'github', 'local')`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN')`);
        await queryRunner.query(`CREATE TYPE "public"."users_level_enum" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'unverified', 'suspended', 'deleted')`);
        await queryRunner.query(`CREATE TABLE "users" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(50), "email" character varying(255) NOT NULL, "name" character varying(255), "avatar_url" character varying(500), "bio" text, "country" character varying(100), "social_links" jsonb NOT NULL DEFAULT '{}', "password" character varying(255), "is_verified" boolean NOT NULL DEFAULT false, "email_verification_token" character varying, "password_reset_token" character varying, "password_reset_expires" TIMESTAMP WITH TIME ZONE, "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'local', "refresh_token" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "level" "public"."users_level_enum" NOT NULL DEFAULT 'BEGINNER', "status" "public"."users_status_enum" NOT NULL DEFAULT 'unverified', "deleted_at" TIMESTAMP WITH TIME ZONE, "suspended_at" TIMESTAMP WITH TIME ZONE, "suspension_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_951b8f1dfc94ac1d0301a14b7e1" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON "users" ("status") `);
        await queryRunner.query(`CREATE TYPE "public"."patients_gender_enum" AS ENUM('male', 'female', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."patients_blood_group_enum" AS ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')`);
        await queryRunner.query(`CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patient_id" character varying(20) NOT NULL, "full_name" character varying(255) NOT NULL, "phone" character varying(20) NOT NULL, "dob" date, "gender" "public"."patients_gender_enum", "blood_group" "public"."patients_blood_group_enum", "email" character varying(255), "address" text, "city" character varying(100), "medical_history" text, "allergies" jsonb NOT NULL DEFAULT '[]', "emergency_name" character varying(255), "emergency_phone" character varying(20), "emergency_relation" character varying(100), "referred_by" character varying(255), "occupation" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1dc2db3a63a0bf2388fbfee86b1" UNIQUE ("patient_id"), CONSTRAINT "UQ_8e8e6b29f954d02d0cf410dbaff" UNIQUE ("phone"), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1e23017f3b56fa3ee6611392c4" ON "patients" ("full_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_61e4e6a8a7507c253dfb2eddbf" ON "patients" ("is_active") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8e8e6b29f954d02d0cf410dbaf" ON "patients" ("phone") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1dc2db3a63a0bf2388fbfee86b" ON "patients" ("patient_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1dc2db3a63a0bf2388fbfee86b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e8e6b29f954d02d0cf410dbaf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_61e4e6a8a7507c253dfb2eddbf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e23017f3b56fa3ee6611392c4"`);
        await queryRunner.query(`DROP TABLE "patients"`);
        await queryRunner.query(`DROP TYPE "public"."patients_blood_group_enum"`);
        await queryRunner.query(`DROP TYPE "public"."patients_gender_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3676155292d72c67cd4e090514"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_level_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_provider_enum"`);
    }

}
