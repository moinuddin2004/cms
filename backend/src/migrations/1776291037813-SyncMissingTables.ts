import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncMissingTables1776291037813 implements MigrationInterface {
    name = 'SyncMissingTables1776291037813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_sessions" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "user_agent" text, "device" character varying(255), "browser" character varying(100), "os" character varying(100), "ip_address" character varying(45), "location" character varying(255), "is_current" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "last_active_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fe5c2a28cde7668fd49a3e51128" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ead56a334d703fe8605f173b44" ON "user_sessions" ("user_id", "is_revoked") `);
        await queryRunner.query(`CREATE TYPE "public"."security_logs_event_type_enum" AS ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'LOGOUT_ALL', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'EMAIL_VERIFICATION_SENT', 'EMAIL_VERIFIED', 'SESSION_CREATED', 'SESSION_REVOKED', 'SESSION_EXPIRED', 'TOKEN_REFRESHED', 'OAUTH_LINK', 'OAUTH_UNLINK', 'ACCOUNT_SUSPENDED', 'ACCOUNT_DELETED', 'ACCOUNT_RESTORED', 'NEW_DEVICE_LOGIN', 'SUSPICIOUS_ACTIVITY')`);
        await queryRunner.query(`CREATE TABLE "security_logs" ("uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "event_type" "public"."security_logs_event_type_enum" NOT NULL, "ip_address" character varying(45), "user_agent" text, "metadata" jsonb NOT NULL DEFAULT '{}', "session_id" uuid, "success" boolean NOT NULL DEFAULT true, "error_message" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_468d8d14352bbc114df498ab3db" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b4bbd742cc4520d66a4378998b" ON "security_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_31abffa0dcd252c7ef1513692e" ON "security_logs" ("user_id", "event_type") `);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "security_logs" ADD CONSTRAINT "FK_3fc41b4fda367506672e9030ad0" FOREIGN KEY ("user_id") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "security_logs" DROP CONSTRAINT "FK_3fc41b4fda367506672e9030ad0"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_31abffa0dcd252c7ef1513692e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b4bbd742cc4520d66a4378998b"`);
        await queryRunner.query(`DROP TABLE "security_logs"`);
        await queryRunner.query(`DROP TYPE "public"."security_logs_event_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ead56a334d703fe8605f173b44"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
    }

}
