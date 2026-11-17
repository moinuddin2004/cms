import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { PatientSessionEvents } from 'src/patient-auth/patient-session-events';
import type { PatientContext } from '../context/patient-context';
import {
  LockedLink,
  revokeLinkByPatient,
} from '../links/patient-account-links.service';
import { REMOVED_PROFILE_NAME } from '../profiles/patient-profiles.service';

export const ACCOUNT_AUDIT_ENTITY = 'patient_account';
export const ACCOUNT_DELETED_REASON = 'account_deleted';

/**
 * Irreversible account deletion (P-09, M2-11). One transaction:
 *
 * 1. lock the account (a second delete finds nothing → 404);
 * 2. revoke every active/frozen link as the patient (audit + access log +
 *    realtime event per clinic link, same as an unlink);
 * 3. soft-delete the profiles (name / dob / gender stripped) — the revoked link
 *    rows stay as the clinic's history (A-22); reminders and dose history
 *    (M3) are deleted with them;
 * 4. delete the sign-in identities and pending login codes, so signing up again
 *    with the same email / Google account is a brand-new account (M2-02 review #5);
 * 5. revoke every session;
 * 6. soft-delete the account row and strip its personal data
 *    (`patient_access_log` keeps only the account id, 07 §6.2).
 */
@Injectable()
export class PatientAccountService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @Optional() private readonly sessionEvents?: PatientSessionEvents,
  ) {}

  async deleteAccount(ctx: PatientContext): Promise<{ deleted: true }> {
    await this.dataSource.transaction(async (m) => {
      const [account] = await sqlRows<{ id: string; email: string }>(
        m,
        `SELECT id, email FROM patient_accounts
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE`,
        [ctx.accountId],
      );
      if (!account) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Not found',
        });
      }

      const links = await sqlRows<LockedLink>(
        m,
        `SELECT l.id, l.profile_id, l.organization_id, l.patient_id, l.status
           FROM patient_record_links l
           JOIN patient_profiles p ON p.id = l.profile_id AND p.account_id = $1
          WHERE l.status IN ('active', 'frozen')
          ORDER BY l.id
          FOR UPDATE OF l`,
        [ctx.accountId],
      );
      for (const link of links) {
        await revokeLinkByPatient(
          m,
          this.audit,
          ctx.accountId,
          link,
          ACCOUNT_DELETED_REASON,
        );
      }

      // Reminders + dose history go with the profiles (A-22, privacy policy §4). The profiles are
      // only soft-deleted, so the ON DELETE CASCADE never fires: delete the schedules explicitly
      // (their dose events cascade from the schedules). Audit H2.
      const profileIds = (
        await sqlRows<{ id: string }>(
          m,
          `SELECT id FROM patient_profiles WHERE account_id = $1`,
          [ctx.accountId],
        )
      ).map((r) => r.id);
      if (profileIds.length > 0) {
        await m.query(
          `DELETE FROM medication_schedules WHERE profile_id = ANY($1)`,
          [profileIds],
        );
      }

      // Soft delete (A-22): the revoked link rows (who revoked, when, why) are
      // the clinic's history and stay; every personal field of the profiles goes.
      await m.query(
        `UPDATE patient_profiles
            SET deleted_at = now(), full_name = $2, dob = NULL, gender = NULL,
                private_reminders = false, updated_at = now()
          WHERE account_id = $1 AND deleted_at IS NULL`,
        [ctx.accountId, REMOVED_PROFILE_NAME],
      );
      await m.query(
        `DELETE FROM patient_account_identities WHERE account_id = $1`,
        [ctx.accountId],
      );
      await m.query(`DELETE FROM patient_login_codes WHERE email = $1`, [
        account.email.toLowerCase(),
      ]);
      await m.query(
        `UPDATE patient_sessions
            SET revoked_at = COALESCE(revoked_at, now()), ip = NULL, device_label = NULL
          WHERE account_id = $1`,
        [ctx.accountId],
      );
      // The phones stop receiving pushes (M3-07).
      await m.query(`DELETE FROM patient_devices WHERE account_id = $1`, [
        ctx.accountId,
      ]);
      // Consent rows are the legal record; only the IP goes.
      await m.query(
        `UPDATE patient_account_consents SET ip = NULL WHERE account_id = $1`,
        [ctx.accountId],
      );
      await m.query(
        `UPDATE patient_accounts
            SET status = 'deleted', deleted_at = now(), full_name = NULL,
                email = $2, email_verified_at = NULL,
                phone = NULL, phone_verified_at = NULL, updated_at = now()
          WHERE id = $1`,
        [ctx.accountId, `deleted+${ctx.accountId}@deleted.invalid`],
      );

      // Ids and counts only: no name, no email.
      await this.audit.record(
        m,
        { userId: null, side: ActorSide.SYSTEM },
        {
          organizationId: null,
          entityType: ACCOUNT_AUDIT_ENTITY,
          entityId: ctx.accountId,
          action: AuditAction.DELETE,
          before: { status: 'active' },
          after: { status: 'deleted', linksRevoked: links.length },
        },
      );
    });
    this.sessionEvents?.revoked({ accountId: ctx.accountId });
    return { deleted: true };
  }
}
