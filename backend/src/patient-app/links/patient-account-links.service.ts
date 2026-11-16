import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { APP_LINK_AUDIT_ENTITY } from 'src/patient-links/patient-links.service';
import { publishPatientLinkEvent } from 'src/patient-links/patient-link-events';
import type { PatientContext } from '../context/patient-context';
import { PatientClinicsService } from '../reads/patient-clinics.service';
import type { LocationRefDto } from '../reads/patient-reads.types';
import type {
  PatientLinkDto,
  PatientLinkHistoryDto,
} from './patient-links.dto';

const LINKED_BY_LABEL = 'Clinic QR';
const MAX_LINK_ROWS = 200;

interface LinkRow {
  id: string;
  profile_id: string;
  organization_id: string;
  status: 'active' | 'frozen' | 'revoked';
  link_method: string;
  linked_at: Date;
  revoked_at: Date | null;
  revoked_by_type: 'patient' | 'clinic' | 'system' | null;
  loc_id: string | null;
  loc_name: string | null;
  loc_timezone: string | null;
  loc_phone: string | null;
  loc_address: string | null;
}

export interface LockedLink {
  id: string;
  profile_id: string;
  organization_id: string;
  patient_id: string;
  status: string;
}

/** The clinic resolver only reads `links[].organizationId`; the rest is filler. */
function orgOnlyContext(
  ctx: PatientContext,
  rows: { id: string; profileId: string; organizationId: string }[],
): PatientContext {
  return {
    ...ctx,
    links: rows.map((r) => ({
      ...r,
      patientId: '',
      status: 'active' as const,
      patientAppEnabled: true,
    })),
  };
}

/**
 * The account's own view of its clinic links (P-08) and the patient-side
 * unlink. Every query is scoped by the signed-in account through
 * `patient_profiles.account_id`; ids from the client are only ever matched
 * against that set (A-05).
 */
@Injectable()
export class PatientAccountLinksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clinics: PatientClinicsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Links of the account with clinic data. A clinic that was never approved is
   * hidden (A-19). Revoked links are included only when asked for.
   */
  async list(
    ctx: PatientContext,
    opts: { includeRevoked: boolean },
  ): Promise<PatientLinkDto[]> {
    const rows = await sqlRows<LinkRow>(
      this.dataSource,
      `SELECT l.id, l.profile_id, l.organization_id, l.status, l.link_method,
              COALESCE(l.verified_at, l.created_at) AS linked_at,
              l.revoked_at, l.revoked_by_type,
              loc.id AS loc_id, loc.name AS loc_name, loc.timezone AS loc_timezone,
              loc.phone AS loc_phone, loc.address AS loc_address
         FROM patient_record_links l
         JOIN patient_profiles p ON p.id = l.profile_id AND p.account_id = $1
                              AND p.deleted_at IS NULL
         JOIN patients pt ON pt.id = l.patient_id
         LEFT JOIN LATERAL (
           SELECT x.id, x.name, x.timezone, x.phone, x.address
             FROM locations x
            WHERE x.organization_id = l.organization_id AND x.is_active = true
            ORDER BY (x.id = pt.primary_location_id) DESC, x.is_main_branch DESC, x.created_at ASC
            LIMIT 1
         ) loc ON true
        WHERE ($2::boolean OR l.status IN ('active', 'frozen'))
        ORDER BY (l.status = 'revoked'), l.created_at DESC
        LIMIT ${MAX_LINK_ROWS}`,
      [ctx.accountId, opts.includeRevoked],
    );
    if (rows.length === 0) return [];

    const { clinics } = await this.clinics.visibleScope(
      orgOnlyContext(
        ctx,
        rows.map((r) => ({
          id: r.id,
          profileId: r.profile_id,
          organizationId: r.organization_id,
        })),
      ),
    );

    const out: PatientLinkDto[] = [];
    for (const r of rows) {
      const info = clinics.get(r.organization_id);
      if (!info) continue; // never approved: no trace in the app
      const location: LocationRefDto | null = r.loc_id
        ? {
            id: r.loc_id,
            name: r.loc_name ?? '',
            timezone: r.loc_timezone ?? info.timezone,
            phone: r.loc_phone,
            whatsapp: null,
            address: r.loc_address,
          }
        : null;
      out.push({
        id: r.id,
        profileId: r.profile_id,
        clinic: info.ref,
        location,
        status: r.status,
        linkedAt: new Date(r.linked_at).toISOString(),
        linkMethod: r.link_method,
        linkedByLabel: LINKED_BY_LABEL,
        revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
        revokedBy: r.revoked_by_type,
      });
    }
    return out;
  }

  /**
   * Patient-side revoke. Allowed for a frozen link and for a clinic that
   * switched the app off: the patient can always cut a link. Audited
   * (clinic-visible history), access-logged, realtime event in the same
   * transaction.
   */
  async unlink(
    ctx: PatientContext,
    linkId: string,
  ): Promise<{ revoked: true }> {
    // Cheap pre-check against the guard's context (own, non-revoked links).
    if (!ctx.links.some((l) => l.id === linkId)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    await this.dataSource.transaction(async (m) => {
      const [link] = await sqlRows<LockedLink>(
        m,
        `SELECT l.id, l.profile_id, l.organization_id, l.patient_id, l.status
           FROM patient_record_links l
           JOIN patient_profiles p ON p.id = l.profile_id AND p.account_id = $2
                              AND p.deleted_at IS NULL
          WHERE l.id = $1 AND l.status IN ('active', 'frozen')
          FOR UPDATE OF l`,
        [linkId, ctx.accountId],
      );
      if (!link) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Not found',
        });
      }
      await revokeLinkByPatient(m, this.audit, ctx.accountId, link, null);
    });
    return { revoked: true };
  }

  async history(
    ctx: PatientContext,
    linkId: string,
  ): Promise<PatientLinkHistoryDto[]> {
    const [row] = await sqlRows<{
      profile_id: string;
      organization_id: string;
      linked_at: Date;
      revoked_at: Date | null;
      revoked_by_type: 'patient' | 'clinic' | 'system' | null;
    }>(
      this.dataSource,
      `SELECT l.profile_id, l.organization_id,
              COALESCE(l.verified_at, l.created_at) AS linked_at,
              l.revoked_at, l.revoked_by_type
         FROM patient_record_links l
         JOIN patient_profiles p ON p.id = l.profile_id AND p.account_id = $2
                              AND p.deleted_at IS NULL
        WHERE l.id = $1`,
      [linkId, ctx.accountId],
    );
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    const { clinics } = await this.clinics.visibleScope(
      orgOnlyContext(ctx, [
        {
          id: linkId,
          profileId: row.profile_id,
          organizationId: row.organization_id,
        },
      ]),
    );
    if (!clinics.has(row.organization_id)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }

    const out: PatientLinkHistoryDto[] = [
      {
        at: new Date(row.linked_at).toISOString(),
        action: 'linked',
        label: 'Linked',
      },
    ];
    if (row.revoked_at) {
      const by = row.revoked_by_type;
      out.push({
        at: new Date(row.revoked_at).toISOString(),
        action:
          by === 'patient'
            ? 'unlinked_by_you'
            : by === 'clinic'
              ? 'revoked_by_clinic'
              : 'revoked_by_system',
        label:
          by === 'patient'
            ? 'Unlinked by you'
            : by === 'clinic'
              ? 'Removed by the clinic'
              : 'Removed by the system',
      });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }
}

/**
 * Revoke one link on the patient's behalf inside the caller's transaction:
 * row update, `patient_access_log` (`unlink`), clinic-visible audit row and the
 * `patient.link_revoked` realtime event (07 §8). Shared by unlink and account
 * deletion. The caller has locked `link` and checked ownership.
 */
export async function revokeLinkByPatient(
  m: EntityManager,
  audit: AuditService,
  accountId: string,
  link: LockedLink,
  reason: string | null,
): Promise<void> {
  await m.query(
    `UPDATE patient_record_links
        SET status = 'revoked', revoked_at = now(), revoked_by_type = 'patient',
            revoked_by_id = $2, revoke_reason = $3, updated_at = now()
      WHERE id = $1`,
    [link.id, accountId, reason],
  );
  await m.query(
    `INSERT INTO patient_access_log
       (account_id, profile_id, organization_id, patient_id, action, resource_type, resource_id)
     VALUES ($1, $2, $3, $4, 'unlink', 'link', $5)`,
    [
      accountId,
      link.profile_id,
      link.organization_id,
      link.patient_id,
      link.id,
    ],
  );
  await audit.record(
    m,
    { userId: null, side: ActorSide.SYSTEM },
    {
      organizationId: link.organization_id,
      entityType: APP_LINK_AUDIT_ENTITY,
      entityId: link.id,
      subjectId: link.patient_id,
      action: AuditAction.UPDATE,
      before: { status: link.status },
      after: { status: 'revoked', revokedBy: 'patient', reason },
    },
  );
  await publishPatientLinkEvent(m, {
    code: 'patient.link_revoked',
    organizationId: link.organization_id,
    accountId,
    linkId: link.id,
  });
}
