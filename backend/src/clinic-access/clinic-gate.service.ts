import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClinicApprovalStatus } from 'src/common/enums/clinic-approval-status.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
import {
  ConfigScope,
  ConfigValue,
} from 'src/settings-registry/entities/config-value.entity';
import { SettingsRegistryService } from 'src/settings-registry/settings-registry.service';
import { SIGN_IN_POLICY_SETTINGS } from './sign-in-policy.settings';

export interface SignInPolicy {
  googleEnabled: boolean;
  requireGoogle: boolean;
  googleDomains: string[];
  joinRequestsEnabled: boolean;
}

/** How the current session signed in (from the access token). */
export interface SessionAuthInfo {
  method: string;
  domain?: string | null;
}

export type GateCode =
  | 'CLINIC_PENDING_APPROVAL'
  | 'CLINIC_REJECTED'
  | 'GOOGLE_SIGN_IN_REQUIRED'
  | 'GOOGLE_SIGN_IN_DISABLED'
  | 'GOOGLE_DOMAIN_NOT_ALLOWED';

/** Why a clinic can't be opened from this session; null = it can. */
export interface GateBlock {
  code: GateCode;
  message: string;
}

const CACHE_MS = 30_000;

/**
 * The one place that decides whether a session may use a clinic at all:
 * the clinic must be approved by a super admin, and the session's sign-in
 * method must satisfy the clinic's sign-in policy. Checked on every tenant
 * request (TenantContextGuard), on location selection, and reported per
 * clinic in the login payload so the web app can explain a block up front.
 * Super admins are never gated.
 */
@Injectable()
export class ClinicGateService {
  private readonly approvalCache = new Map<
    string,
    { value: { status: ClinicApprovalStatus; note: string | null }; at: number }
  >();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsRegistryService,
  ) {}

  async approval(
    orgId: string,
  ): Promise<{ status: ClinicApprovalStatus; note: string | null }> {
    const hit = this.approvalCache.get(orgId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const org = await this.dataSource.getRepository(Organization).findOne({
      where: { id: orgId },
      select: { id: true, approvalStatus: true, approvalNote: true },
    });
    const value = {
      status: org?.approvalStatus ?? ClinicApprovalStatus.APPROVED,
      note: org?.approvalNote ?? null,
    };
    this.approvalCache.set(orgId, { value, at: Date.now() });
    return value;
  }

  /** After an approval decision, so this instance sees it at once. */
  invalidate(orgId: string): void {
    this.approvalCache.delete(orgId);
  }

  async policy(orgId: string): Promise<SignInPolicy> {
    const k = SIGN_IN_POLICY_SETTINGS;
    const v = await this.settings.getMany(
      [
        k.googleEnabled.key,
        k.requireGoogle.key,
        k.googleDomains.key,
        k.joinRequestsEnabled.key,
      ],
      { organizationId: orgId },
    );
    return {
      googleEnabled: v[k.googleEnabled.key] !== false,
      requireGoogle: v[k.requireGoogle.key] === true,
      googleDomains: (v[k.googleDomains.key] as string[] | null) ?? [],
      joinRequestsEnabled: v[k.joinRequestsEnabled.key] === true,
    };
  }

  async blockFor(
    orgId: string,
    auth: SessionAuthInfo,
  ): Promise<GateBlock | null> {
    const approval = await this.approval(orgId);
    if (approval.status === ClinicApprovalStatus.PENDING) {
      return {
        code: 'CLINIC_PENDING_APPROVAL',
        message:
          'This clinic is waiting for approval. You can use it as soon as it is approved.',
      };
    }
    if (approval.status === ClinicApprovalStatus.REJECTED) {
      return {
        code: 'CLINIC_REJECTED',
        message: approval.note
          ? `This clinic's registration was not approved: ${approval.note}`
          : "This clinic's registration was not approved. Contact support.",
      };
    }
    return policyBlock(await this.policy(orgId), auth);
  }

  /** Throws 403 with the block's code when the session can't use the clinic. */
  async assertUsable(orgId: string, auth: SessionAuthInfo): Promise<void> {
    const block = await this.blockFor(orgId, auth);
    if (block) {
      throw new ForbiddenException({
        message: block.message,
        code: block.code,
      });
    }
  }

  /**
   * Approved clinics that take join requests from this Google Workspace
   * domain. Personal Google accounts (no `hd`) match none.
   */
  async joinableClinics(
    hd: string | null | undefined,
  ): Promise<{ id: string; name: string }[]> {
    if (!hd) return [];
    const domain = hd.toLowerCase();
    const rows = await this.dataSource
      .getRepository(ConfigValue)
      .createQueryBuilder('c')
      .select('c.scope_id', 'orgId')
      .where('c.scope_type = :scope', { scope: ConfigScope.ORG })
      .andWhere('c.key = :key', {
        key: SIGN_IN_POLICY_SETTINGS.googleDomains.key,
      })
      .andWhere('c.value @> CAST(:needle AS jsonb)', {
        needle: JSON.stringify([domain]),
      })
      .getRawMany<{ orgId: string }>();
    const out: { id: string; name: string }[] = [];
    for (const { orgId } of rows) {
      const policy = await this.policy(orgId);
      if (!policy.joinRequestsEnabled || !policy.googleEnabled) continue;
      const org = await this.dataSource.getRepository(Organization).findOne({
        where: {
          id: orgId,
          isActive: true,
          approvalStatus: ClinicApprovalStatus.APPROVED,
        },
        select: { id: true, name: true },
      });
      if (org) out.push({ id: org.id, name: org.name });
    }
    return out;
  }
}

/** Pure policy check — exported for the spec. */
export function policyBlock(
  policy: SignInPolicy,
  auth: SessionAuthInfo,
): GateBlock | null {
  if (auth.method === 'google') {
    if (!policy.googleEnabled) {
      return {
        code: 'GOOGLE_SIGN_IN_DISABLED',
        message:
          'This clinic does not allow Google sign-in. Sign in with your email and password.',
      };
    }
    if (policy.googleDomains.length) {
      const hd = auth.domain?.toLowerCase() ?? null;
      if (!hd || !policy.googleDomains.includes(hd)) {
        return {
          code: 'GOOGLE_DOMAIN_NOT_ALLOWED',
          message: `This clinic only allows Google accounts from ${policy.googleDomains.join(', ')}.`,
        };
      }
    }
    return null;
  }
  if (policy.requireGoogle && policy.googleEnabled) {
    return {
      code: 'GOOGLE_SIGN_IN_REQUIRED',
      message:
        'This clinic requires Google sign-in. Sign out and continue with Google.',
    };
  }
  return null;
}
