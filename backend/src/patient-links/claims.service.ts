import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { pgError, sqlRows } from 'src/common/database/sql';
import type { PatientContext } from 'src/patient-app/context/patient-context';
import { assertProfile } from 'src/patient-app/context/patient-context';
import { AcceptClaimDto } from './dto/patient-links.dto';
import {
  ageBand,
  AgeBand,
  CLAIM_TOKEN_PATTERN,
  hashClaimToken,
  LINK_CONSENT_VERSION,
  maskName,
} from './claim-token';
import { ClaimEligibilityService } from './claim-eligibility.service';
import { publishPatientLinkEvent } from './patient-link-events';
import { APP_LINK_AUDIT_ENTITY } from './patient-links.service';

interface ClaimRow {
  id: string;
  organization_id: string;
  patient_id: string;
  created_by_user_id: string;
  patient_full_name: string;
  patient_dob: string | null;
  patient_gender: string | null;
  patient_is_minor: boolean;
  patient_is_active: boolean;
  primary_location_id: string | null;
}

export interface ClinicRef {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
}

export interface LocationRef {
  id: string;
  name: string;
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}

export interface ClaimPreview {
  clinic: ClinicRef;
  location: { name: string };
  maskedName: string;
  ageBand: AgeBand | null;
  isMinor: boolean;
  alreadyLinkedToYou: boolean;
}

export interface AcceptedProfile {
  id: string;
  relation: string;
  fullName: string;
  dob: string | null;
  gender: string | null;
  isSelf: boolean;
}

export interface AcceptedLink {
  id: string;
  profileId: string;
  clinic: ClinicRef;
  location: LocationRef | null;
  status: 'active' | 'frozen';
  linkedAt: Date;
  linkMethod: 'staff_qr';
  linkedByLabel: string;
}

const DEFAULT_BRAND_COLOR = '#2563eb';
const LINKED_BY_LABEL = 'Clinic QR';

/** Patient side of the claim flow: preview a QR token and accept it. */
@Injectable()
export class ClaimsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly eligibility: ClaimEligibilityService,
  ) {}

  async preview(ctx: PatientContext, token: string): Promise<ClaimPreview> {
    const claim = await this.loadValid(this.dataSource.manager, token, false);
    ClaimEligibilityService.assertOk(
      await this.eligibility.check(claim.organization_id),
      true,
    );
    const clinic = await this.clinicRef(
      this.dataSource.manager,
      claim.organization_id,
    );
    const location = await this.locationRef(
      this.dataSource.manager,
      claim.organization_id,
      claim.primary_location_id,
    );
    return {
      clinic,
      location: { name: location?.name ?? clinic.name },
      maskedName: maskName(claim.patient_full_name),
      ageBand: ageBand(claim.patient_dob, new Date()),
      isMinor: claim.patient_is_minor,
      alreadyLinkedToYou: ctx.links.some(
        (l) =>
          l.organizationId === claim.organization_id &&
          l.patientId === claim.patient_id,
      ),
    };
  }

  async accept(
    ctx: PatientContext,
    token: string,
    dto: AcceptClaimDto,
    ip: string | null,
  ): Promise<{ link: AcceptedLink; profile: AcceptedProfile }> {
    try {
      return await this.dataSource.transaction((m) =>
        this.acceptInTx(m, ctx, token, dto, ip),
      );
    } catch (err) {
      const e = pgError(err);
      if (
        e.code === '23505' &&
        e.constraint === 'uq_patient_record_links_active_patient'
      ) {
        throw this.alreadyLinked();
      }
      throw err;
    }
  }

  private async acceptInTx(
    m: EntityManager,
    ctx: PatientContext,
    token: string,
    dto: AcceptClaimDto,
    ip: string | null,
  ): Promise<{ link: AcceptedLink; profile: AcceptedProfile }> {
    const claim = await this.loadValid(m, token, true);
    const orgId = claim.organization_id;
    ClaimEligibilityService.assertOk(
      await this.eligibility.check(orgId, m),
      true,
    );
    if (!claim.patient_is_active) ClaimEligibilityService.invalid();

    const [account] = await sqlRows<{ full_name: string | null }>(
      m,
      `SELECT full_name FROM patient_accounts WHERE id = $1`,
      [ctx.accountId],
    );

    // Someone already holds this clinic patient?
    const [existing] = await sqlRows<{
      id: string;
      profile_id: string;
      account_id: string;
      status: 'active' | 'frozen';
      linked_at: Date;
    }>(
      m,
      `SELECT l.id, l.profile_id, p.account_id, l.status,
              COALESCE(l.verified_at, l.created_at) AS linked_at
         FROM patient_record_links l
         JOIN patient_profiles p ON p.id = l.profile_id
        WHERE l.organization_id = $1 AND l.patient_id = $2
          AND l.status IN ('active', 'frozen')
        LIMIT 1`,
      [orgId, claim.patient_id],
    );
    if (existing && existing.account_id !== ctx.accountId) {
      throw this.alreadyLinked();
    }

    // Profile: an existing one of this account, or a new one.
    let profile: AcceptedProfile;
    if (existing) {
      profile = await this.profileById(m, existing.profile_id);
    } else if (dto.profileId) {
      assertProfile(ctx, dto.profileId); // 404 NOT_FOUND outside the account
      const [row] = await sqlRows<{
        id: string;
        relation: string;
        full_name: string;
        dob: string | null;
        gender: string | null;
      }>(
        m,
        `SELECT id, relation, full_name, dob::text AS dob, gender FROM patient_profiles
          WHERE id = $1 AND account_id = $2`,
        [dto.profileId, ctx.accountId],
      );
      if (!row) ClaimEligibilityService.invalid();
      if (row.relation !== dto.relation) {
        throw new BadRequestException({
          code: 'RELATION_MISMATCH',
          message: 'The chosen profile has a different relation',
        });
      }
      profile = toProfile(row);
    } else {
      const [self] =
        dto.relation === 'self'
          ? await sqlRows<{
              id: string;
              relation: string;
              full_name: string;
              dob: string | null;
              gender: string | null;
            }>(
              m,
              `SELECT id, relation, full_name, dob::text AS dob, gender FROM patient_profiles
                WHERE account_id = $1 AND relation = 'self'`,
              [ctx.accountId],
            )
          : [];
      if (self) {
        profile = toProfile(self);
      } else {
        const name =
          dto.newProfileName ??
          (dto.relation === 'self'
            ? (account?.full_name ?? claim.patient_full_name)
            : undefined);
        if (!name) {
          throw new BadRequestException({
            code: 'NAME_REQUIRED',
            message: 'A name is required for a new profile',
          });
        }
        const [created] = await sqlRows<{
          id: string;
          relation: string;
          full_name: string;
          dob: string | null;
          gender: string | null;
        }>(
          m,
          `INSERT INTO patient_profiles (account_id, relation, full_name, dob, gender)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, relation, full_name, dob::text AS dob, gender`,
          [
            ctx.accountId,
            dto.relation,
            name,
            claim.patient_dob,
            claim.patient_gender,
          ],
        );
        profile = toProfile(created);
      }
    }

    const clinic = await this.clinicRef(m, orgId);
    const location = await this.locationRef(
      m,
      orgId,
      claim.primary_location_id,
    );
    let linkId: string;
    let linkedAt: Date;
    let linkStatus: 'active' | 'frozen' = 'active';

    if (existing) {
      // Same account scanned again: idempotent, nothing new is created.
      linkId = existing.id;
      linkedAt = existing.linked_at;
      linkStatus = existing.status;
    } else {
      const [link] = await sqlRows<{ id: string; linked_at: Date }>(
        m,
        `INSERT INTO patient_record_links
           (profile_id, organization_id, patient_id, status, link_method,
            verified_by_user_id, verified_at)
         VALUES ($1, $2, $3, 'active', 'staff_qr', $4, now())
         RETURNING id, verified_at AS linked_at`,
        [profile.id, orgId, claim.patient_id, claim.created_by_user_id],
      );
      linkId = link.id;
      linkedAt = link.linked_at;

      await m.query(
        `INSERT INTO patient_account_consents (account_id, kind, version, organization_id, ip)
         VALUES ($1, 'link', $2, $3, $4)`,
        [ctx.accountId, LINK_CONSENT_VERSION, orgId, ip],
      );
      await m.query(
        `INSERT INTO patient_access_log
           (account_id, profile_id, organization_id, patient_id, action, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, 'link', 'link', $5)`,
        [ctx.accountId, profile.id, orgId, claim.patient_id, linkId],
      );
      await this.audit.record(
        m,
        { userId: null, side: ActorSide.SYSTEM, ip },
        {
          organizationId: orgId,
          entityType: APP_LINK_AUDIT_ENTITY,
          entityId: linkId,
          subjectId: claim.patient_id,
          action: AuditAction.CREATE,
          after: {
            status: 'active',
            linkMethod: 'staff_qr',
            accountId: ctx.accountId,
            profileId: profile.id,
          },
        },
      );
      await publishPatientLinkEvent(m, {
        code: 'patient.record_linked',
        organizationId: orgId,
        accountId: ctx.accountId,
        linkId,
      });
    }

    // Single use; every other unused token of this patient dies with it.
    await m.query(
      `UPDATE patient_claim_tokens SET used_at = now(), used_by_account_id = $2
        WHERE id = $1`,
      [claim.id, ctx.accountId],
    );
    await m.query(
      `UPDATE patient_claim_tokens SET invalidated_at = now()
        WHERE organization_id = $1 AND patient_id = $2
          AND used_at IS NULL AND invalidated_at IS NULL`,
      [orgId, claim.patient_id],
    );

    return {
      link: {
        id: linkId,
        profileId: profile.id,
        clinic,
        location,
        status: linkStatus,
        linkedAt,
        linkMethod: 'staff_qr',
        linkedByLabel: LINKED_BY_LABEL,
      },
      profile,
    };
  }

  /** One lookup; unknown, used, invalidated and expired all look the same. */
  private async loadValid(
    m: EntityManager,
    token: string,
    lock: boolean,
  ): Promise<ClaimRow> {
    if (!CLAIM_TOKEN_PATTERN.test(token)) ClaimEligibilityService.invalid();
    const [row] = await sqlRows<ClaimRow>(
      m,
      `SELECT t.id, t.organization_id, t.patient_id, t.created_by_user_id,
              p.full_name AS patient_full_name, p.dob::text AS patient_dob,
              p.gender::text AS patient_gender, p.is_minor AS patient_is_minor,
              p.is_active AS patient_is_active, p.primary_location_id
         FROM patient_claim_tokens t
         JOIN patients p ON p.id = t.patient_id AND p.deleted_at IS NULL
        WHERE t.token_hash = $1
          AND t.used_at IS NULL AND t.invalidated_at IS NULL
          AND t.expires_at > now()
        ${lock ? 'FOR UPDATE OF t' : ''}`,
      [hashClaimToken(token)],
    );
    if (!row) ClaimEligibilityService.invalid();
    return row;
  }

  private alreadyLinked(): ConflictException {
    return new ConflictException({
      code: 'ALREADY_LINKED',
      message: 'This record is already linked to an app account',
    });
  }

  private async profileById(
    m: EntityManager,
    id: string,
  ): Promise<AcceptedProfile> {
    const [row] = await sqlRows<{
      id: string;
      relation: string;
      full_name: string;
      dob: string | null;
      gender: string | null;
    }>(
      m,
      `SELECT id, relation, full_name, dob::text AS dob, gender FROM patient_profiles WHERE id = $1`,
      [id],
    );
    return toProfile(row);
  }

  private async clinicRef(
    m: EntityManager,
    organizationId: string,
  ): Promise<ClinicRef> {
    const [org] = await sqlRows<{ name: string }>(
      m,
      `SELECT name FROM organizations WHERE id = $1`,
      [organizationId],
    );
    const rows = await sqlRows<{ key: string; value: unknown }>(
      m,
      `SELECT key, value FROM config_values
        WHERE scope_type = 'org' AND scope_id = $1
          AND key IN ('theme.brand_color', 'theme.logo_url')`,
      [organizationId],
    );
    const get = (k: string) => {
      const v = rows.find((r) => r.key === k)?.value;
      return typeof v === 'string' && v ? v : null;
    };
    return {
      organizationId,
      name: org?.name ?? '',
      logoUrl: get('theme.logo_url'),
      brandColor: get('theme.brand_color') ?? DEFAULT_BRAND_COLOR,
    };
  }

  private async locationRef(
    m: EntityManager,
    organizationId: string,
    primaryLocationId: string | null,
  ): Promise<LocationRef | null> {
    const [loc] = await sqlRows<{
      id: string;
      name: string;
      timezone: string;
      phone: string | null;
      address: string | null;
    }>(
      m,
      `SELECT id, name, timezone, phone, address FROM locations
        WHERE organization_id = $1 AND is_active = true
        ORDER BY (id = $2) DESC, is_main_branch DESC, created_at ASC
        LIMIT 1`,
      [organizationId, primaryLocationId],
    );
    return loc ? { ...loc, whatsapp: null } : null;
  }
}

function toProfile(row: {
  id: string;
  relation: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
}): AcceptedProfile {
  return {
    id: row.id,
    relation: row.relation,
    fullName: row.full_name,
    dob: row.dob,
    gender: row.gender,
    isSelf: row.relation === 'self',
  };
}
