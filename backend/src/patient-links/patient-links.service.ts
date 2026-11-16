import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { PatientAccessLog } from 'src/patient-app/entities/patient-access-log.entity';
import { PatientRecordLink } from 'src/patient-app/entities/patient-record-link.entity';
import { PatientClaimToken } from './entities/patient-claim-token.entity';
import {
  CLAIM_TOKEN_TTL_MINUTES,
  generateClaimToken,
  hashClaimToken,
  maskEmail,
} from './claim-token';
import { ClaimEligibilityService } from './claim-eligibility.service';
import { publishPatientLinkEvent } from './patient-link-events';

export const APP_LINK_AUDIT_ENTITY = 'patient_app_link';
export const APP_CLAIM_AUDIT_ENTITY = 'patient_app_claim';

export interface AppLinkStatus {
  status: 'none' | 'active';
  link: {
    id: string;
    linkedAt: Date;
    maskedEmail: string;
    relation: string;
    linkMethod: string;
  } | null;
  pendingClaim: { expiresAt: Date } | null;
}

/** Staff side of the app link: create a claim token, read status, revoke. */
@Injectable()
export class PatientLinksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly eligibility: ClaimEligibilityService,
  ) {}

  async createClaimToken(
    organizationId: string,
    patientId: string,
    actor: ActorRef,
  ): Promise<{ token: string; url: string; expiresAt: Date }> {
    ClaimEligibilityService.assertOk(
      await this.eligibility.check(organizationId),
      false,
    );
    const createdByUserId = actor.userId;
    if (!createdByUserId) throw new UnauthorizedException();
    const token = generateClaimToken();
    const expiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_MINUTES * 60_000);

    await this.dataSource.transaction(async (m) => {
      // Lock the patient row: concurrent token creations / accepts queue here.
      const [patient] = await sqlRows<{ id: string }>(
        m,
        `SELECT id FROM patients
          WHERE id = $1 AND organization_id = $2
            AND is_active = true AND deleted_at IS NULL
          FOR UPDATE`,
        [patientId, organizationId],
      );
      if (!patient) throw new NotFoundException('Patient not found');

      const linked = await m
        .getRepository(PatientRecordLink)
        .createQueryBuilder('l')
        .where('l.organizationId = :organizationId', { organizationId })
        .andWhere('l.patientId = :patientId', { patientId })
        .andWhere(`l.status IN ('active', 'frozen')`)
        .getExists();
      if (linked) {
        throw new ConflictException({
          code: 'ALREADY_LINKED',
          message: 'This patient is already linked to an app account',
        });
      }

      // Newest token wins: older unused ones stop working.
      await m.query(
        `UPDATE patient_claim_tokens SET invalidated_at = now()
          WHERE organization_id = $1 AND patient_id = $2
            AND used_at IS NULL AND invalidated_at IS NULL`,
        [organizationId, patientId],
      );
      const repo = m.getRepository(PatientClaimToken);
      const row = await repo.save(
        repo.create({
          organizationId,
          patientId,
          tokenHash: hashClaimToken(token),
          createdByUserId,
          expiresAt,
        }),
      );
      // Never the token itself.
      await this.audit.record(m, actor, {
        organizationId,
        entityType: APP_CLAIM_AUDIT_ENTITY,
        entityId: row.id,
        subjectId: patientId,
        action: AuditAction.CREATE,
        after: { expiresAt: expiresAt.toISOString() },
      });
    });

    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
      /\/+$/,
      '',
    );
    return { token, url: `${base}/c/${token}`, expiresAt };
  }

  async status(
    organizationId: string,
    patientId: string,
  ): Promise<AppLinkStatus> {
    const [link] = await sqlRows<{
      id: string;
      linked_at: Date;
      email: string;
      relation: string;
      link_method: string;
    }>(
      this.dataSource,
      `SELECT l.id, COALESCE(l.verified_at, l.created_at) AS linked_at,
              a.email, p.relation, l.link_method
         FROM patient_record_links l
         JOIN patient_profiles p ON p.id = l.profile_id
         JOIN patient_accounts a ON a.id = p.account_id
        WHERE l.organization_id = $1 AND l.patient_id = $2
          AND l.status IN ('active', 'frozen')
        ORDER BY l.created_at DESC LIMIT 1`,
      [organizationId, patientId],
    );
    const [pending] = await sqlRows<{ expires_at: Date }>(
      this.dataSource,
      `SELECT expires_at FROM patient_claim_tokens
        WHERE organization_id = $1 AND patient_id = $2
          AND used_at IS NULL AND invalidated_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [organizationId, patientId],
    );
    return {
      status: link ? 'active' : 'none',
      link: link
        ? {
            id: link.id,
            linkedAt: link.linked_at,
            maskedEmail: maskEmail(link.email),
            relation: link.relation,
            linkMethod: link.link_method,
          }
        : null,
      pendingClaim: pending ? { expiresAt: pending.expires_at } : null,
    };
  }

  /** Allowed for a suspended clinic too: a clinic can always cut a link. */
  async revoke(
    organizationId: string,
    patientId: string,
    reason: string | undefined,
    actor: ActorRef,
  ): Promise<{ revoked: true }> {
    await this.dataSource.transaction(async (m) => {
      const [link] = await sqlRows<{
        id: string;
        profile_id: string;
        status: string;
        account_id: string;
      }>(
        m,
        `SELECT l.id, l.profile_id, l.status, p.account_id
           FROM patient_record_links l
           JOIN patient_profiles p ON p.id = l.profile_id
          WHERE l.organization_id = $1 AND l.patient_id = $2
            AND l.status IN ('active', 'frozen')
          FOR UPDATE OF l`,
        [organizationId, patientId],
      );
      if (!link) {
        throw new NotFoundException({
          code: 'NOT_LINKED',
          message: 'This patient has no app link',
        });
      }
      const cleanReason = reason?.trim() || null;
      await m.query(
        `UPDATE patient_record_links
            SET status = 'revoked', revoked_at = now(), revoked_by_type = 'clinic',
                revoked_by_id = $2, revoke_reason = $3, updated_at = now()
          WHERE id = $1`,
        [link.id, actor.userId, cleanReason],
      );
      // A-23: the clinic cut this patient off, so their prescription courses
      // from this clinic stop and disappear from the app.
      await m.query(
        `UPDATE medication_schedules
            SET status = CASE WHEN status IN ('active', 'paused') THEN 'stopped' ELSE status END,
                hidden = true, updated_at = now()
          WHERE profile_id = $1 AND organization_id = $2 AND source = 'prescription'
            AND prescription_id IN (
              SELECT id FROM prescriptions WHERE organization_id = $2 AND patient_id = $3)`,
        [link.profile_id, organizationId, patientId],
      );
      await m.query(
        `UPDATE patient_claim_tokens SET invalidated_at = now()
          WHERE organization_id = $1 AND patient_id = $2
            AND used_at IS NULL AND invalidated_at IS NULL`,
        [organizationId, patientId],
      );
      await m.getRepository(PatientAccessLog).insert({
        accountId: link.account_id,
        profileId: link.profile_id,
        organizationId,
        patientId,
        action: 'unlink',
        resourceType: 'link',
        resourceId: link.id,
      });
      await this.audit.record(m, actor, {
        organizationId,
        entityType: APP_LINK_AUDIT_ENTITY,
        entityId: link.id,
        subjectId: patientId,
        action: AuditAction.UPDATE,
        before: { status: link.status },
        after: { status: 'revoked', reason: cleanReason },
      });
      await publishPatientLinkEvent(m, {
        code: 'patient.link_revoked',
        organizationId,
        accountId: link.account_id,
        linkId: link.id,
        kinds: ['links', 'medications'],
      });
    });
    return { revoked: true };
  }
}
