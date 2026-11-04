import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClinicApprovalStatus } from 'src/common/enums/clinic-approval-status.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmployeesService } from 'src/employees/employees.service';
import { ConfigScope } from 'src/settings-registry/entities/config-value.entity';
import { SettingsRegistryService } from 'src/settings-registry/settings-registry.service';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  ClinicGateService,
  policyBlock,
  SessionAuthInfo,
  SignInPolicy,
} from './clinic-gate.service';
import { SIGN_IN_POLICY_SETTINGS } from './sign-in-policy.settings';
import {
  ClinicJoinRequest,
  JoinRequestStatus,
} from './entities/clinic-join-request.entity';
import { ClinicInvite } from './entities/clinic-invite.entity';

const INVITE_DAYS = 7;
const MAX_ACTIVE_INVITES = 10;
import {
  ApproveJoinRequestDto,
  ClinicApprovalDecisionDto,
  UpdateSignInPolicyDto,
} from './dto/clinic-access.dto';

/**
 * Clinic approval (super admin), the clinic's sign-in policy (owner) and
 * join requests (owner/manager). The per-request checks live in
 * ClinicGateService.
 */
@Injectable()
export class ClinicAccessService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gate: ClinicGateService,
    private readonly settings: SettingsRegistryService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ── Approval (super admin) ────────────────────────────────────────

  async decideApproval(
    orgId: string,
    dto: ClinicApprovalDecisionDto,
    actor: ActorRef,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Organization);
      const org = await repo.findOneBy({ id: orgId });
      if (!org) throw new NotFoundException('Organization not found');
      const before = {
        approvalStatus: org.approvalStatus,
        approvalNote: org.approvalNote,
      };
      const approve = dto.decision === 'approve';
      org.approvalStatus = approve
        ? ClinicApprovalStatus.APPROVED
        : ClinicApprovalStatus.REJECTED;
      org.approvalNote = approve ? null : dto.note?.trim() || null;
      org.approvalDecidedAt = new Date();
      org.approvalDecidedBy = actor.userId;
      await repo.save(org);
      await this.audit.record(manager, actor, {
        organizationId: orgId,
        entityType: 'organization_approval',
        entityId: orgId,
        subjectId: orgId,
        action: AuditAction.UPDATE,
        before,
        after: {
          approvalStatus: org.approvalStatus,
          approvalNote: org.approvalNote,
        },
      });
      return {
        organizationId: org.id,
        approvalStatus: org.approvalStatus,
        approvalNote: org.approvalNote,
        approvalDecidedAt: org.approvalDecidedAt,
      };
    });
    this.gate.invalidate(orgId);
    return result;
  }

  // ── Sign-in policy (owner) ────────────────────────────────────────

  getPolicy(orgId: string): Promise<SignInPolicy> {
    return this.gate.policy(orgId);
  }

  /**
   * Refuses a policy that would lock the person saving it out of the
   * clinic (e.g. "Google only" saved from a password session).
   */
  async savePolicy(
    orgId: string,
    dto: UpdateSignInPolicyDto,
    caller: SessionAuthInfo & { isSuperAdmin: boolean },
    actor: ActorRef,
  ): Promise<SignInPolicy> {
    const next: SignInPolicy = {
      googleEnabled: dto.googleEnabled,
      requireGoogle: dto.requireGoogle,
      googleDomains: dto.googleDomains,
      joinRequestsEnabled: dto.joinRequestsEnabled,
    };
    if (next.requireGoogle && !next.googleEnabled) {
      throw new BadRequestException(
        'Turn on Google sign-in before making it the only way in.',
      );
    }
    if (next.joinRequestsEnabled && !next.googleEnabled) {
      throw new BadRequestException(
        'Join requests need Google sign-in to be on.',
      );
    }
    if (next.joinRequestsEnabled && !next.googleDomains.length) {
      throw new BadRequestException(
        'Add your Google Workspace domain before allowing join requests.',
      );
    }

    if (!caller.isSuperAdmin) {
      const block = policyBlock(
        {
          ...next,
          googleDomains: next.googleDomains.map((d) => d.trim().toLowerCase()),
        },
        caller,
      );
      if (block) {
        throw new BadRequestException(
          `This would lock you out of the clinic. ${block.message}`,
        );
      }
    }

    const k = SIGN_IN_POLICY_SETTINGS;
    // Validates the domains (400 on a bad one) and audits each change.
    await this.settings.setMany(
      ConfigScope.ORG,
      orgId,
      [
        { key: k.googleEnabled.key, value: next.googleEnabled },
        { key: k.requireGoogle.key, value: next.requireGoogle },
        { key: k.googleDomains.key, value: next.googleDomains },
        { key: k.joinRequestsEnabled.key, value: next.joinRequestsEnabled },
      ],
      actor,
    );
    return this.gate.policy(orgId);
  }

  // ── Join requests ─────────────────────────────────────────────────

  /**
   * Called from the Google sign-in flow (the caller verified the Google
   * token). Allowed through a valid invite link of the clinic, or when the
   * clinic takes join requests from the account's Workspace domain.
   */
  async createJoinRequest(input: {
    organizationId: string;
    userId: string;
    email: string;
    name: string;
    phone: string;
    message?: string | null;
    hd: string | null;
    inviteToken?: string | null;
  }): Promise<ClinicJoinRequest> {
    let invite: ClinicInvite | null = null;
    if (input.inviteToken) {
      invite = await this.activeInvite(input.inviteToken);
      if (!invite || invite.organizationId !== input.organizationId) {
        throw new BadRequestException(
          'This invite link has expired. Ask the clinic for a new one.',
        );
      }
    } else {
      const joinable = await this.gate.joinableClinics(input.hd);
      if (!joinable.some((c) => c.id === input.organizationId)) {
        throw new BadRequestException(
          'This clinic does not take join requests from your Google account.',
        );
      }
    }
    const repo = this.dataSource.getRepository(ClinicJoinRequest);
    const pending = await repo.findOneBy({
      organizationId: input.organizationId,
      userId: input.userId,
      status: JoinRequestStatus.PENDING,
    });
    if (pending) return pending;
    if (await this.isMember(input.userId, input.organizationId)) {
      throw new ConflictException('You already work in this clinic.');
    }
    if (invite) {
      await this.dataSource
        .getRepository(ClinicInvite)
        .increment({ id: invite.id }, 'uses', 1);
    }
    return repo.save(
      repo.create({
        organizationId: input.organizationId,
        userId: input.userId,
        email: input.email,
        name: input.name,
        phone: input.phone.trim(),
        message: input.message?.trim() || null,
        status: JoinRequestStatus.PENDING,
      }),
    );
  }

  async listJoinRequests(orgId: string, status?: JoinRequestStatus) {
    return this.dataSource.getRepository(ClinicJoinRequest).find({
      where: {
        organizationId: orgId,
        ...(status ? { status } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /** The signed-in user's own requests, with the clinic name. */
  async myJoinRequests(userId: string) {
    const rows = await this.dataSource.getRepository(ClinicJoinRequest).find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const orgs = rows.length
      ? await this.dataSource.getRepository(Organization).find({
          where: { id: In([...new Set(rows.map((r) => r.organizationId))]) },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(orgs.map((o) => [o.id, o.name]));
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      organizationName: names.get(r.organizationId) ?? 'Clinic',
      status: r.status,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
    }));
  }

  /**
   * Approve: creates the employee at the approver's active location with
   * the chosen role and a login linked to the requester's account.
   */
  async approveJoinRequest(
    id: string,
    ctx: TenantContext,
    dto: ApproveJoinRequestDto,
    actorUserId: string,
  ) {
    const repo = this.dataSource.getRepository(ClinicJoinRequest);
    const request = await repo.findOneBy({
      id,
      organizationId: ctx.organizationId,
    });
    if (!request) throw new NotFoundException('Join request not found');
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new ConflictException('This request was already decided.');
    }
    if (await this.isMember(request.userId, ctx.organizationId)) {
      throw new ConflictException('This person already works in this clinic.');
    }
    await this.subscriptions.assertCanAddUser(ctx.organizationId);

    const employee = await this.employees.create(
      ctx,
      {
        fullName: request.name,
        phone: request.phone,
        designation: dto.designation,
        employmentRoleId: dto.employmentRoleId,
        hasPortalAccess: true,
        userId: request.userId,
      },
      actorUserId,
    );

    request.status = JoinRequestStatus.APPROVED;
    request.decidedBy = actorUserId;
    request.decidedAt = new Date();
    request.employeeId = employee.id;
    await repo.save(request);
    return { request, employeeId: employee.id };
  }

  async rejectJoinRequest(
    id: string,
    orgId: string,
    reason: string | undefined,
    actorUserId: string,
  ) {
    const repo = this.dataSource.getRepository(ClinicJoinRequest);
    const request = await repo.findOneBy({ id, organizationId: orgId });
    if (!request) throw new NotFoundException('Join request not found');
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new ConflictException('This request was already decided.');
    }
    request.status = JoinRequestStatus.REJECTED;
    request.decidedBy = actorUserId;
    request.decidedAt = new Date();
    request.decisionNote = reason?.trim() || null;
    return repo.save(request);
  }

  // ── Invite links ──────────────────────────────────────────────────

  private invites() {
    return this.dataSource.getRepository(ClinicInvite);
  }

  /** An unexpired, unrevoked invite of an approved, active clinic. */
  async activeInvite(token: string): Promise<ClinicInvite | null> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
    const invite = await this.invites().findOneBy({
      token,
      revokedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
    if (!invite) return null;
    const org = await this.dataSource.getRepository(Organization).findOne({
      where: {
        id: invite.organizationId,
        isActive: true,
        approvalStatus: ClinicApprovalStatus.APPROVED,
      },
      select: { id: true },
    });
    return org ? invite : null;
  }

  /** Public: what an invite link page shows before sign-in. */
  async inviteInfo(token: string) {
    const invite = await this.activeInvite(token);
    if (!invite) return { valid: false as const };
    const [org, policy] = await Promise.all([
      this.dataSource.getRepository(Organization).findOne({
        where: { id: invite.organizationId },
        select: { id: true, name: true },
      }),
      this.gate.policy(invite.organizationId),
    ]);
    return {
      valid: true as const,
      organizationId: invite.organizationId,
      clinicName: org?.name ?? 'Clinic',
      googleEnabled: policy.googleEnabled,
      expiresAt: invite.expiresAt,
    };
  }

  listInvites(orgId: string) {
    return this.invites().find({
      where: {
        organizationId: orgId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async createInvite(orgId: string, userId: string): Promise<ClinicInvite> {
    const active = await this.listInvites(orgId);
    if (active.length >= MAX_ACTIVE_INVITES) {
      throw new BadRequestException(
        'Too many open invite links. Revoke one you no longer need.',
      );
    }
    return this.invites().save(
      this.invites().create({
        organizationId: orgId,
        token: randomBytes(24).toString('base64url'),
        createdBy: userId,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      }),
    );
  }

  async revokeInvite(id: string, orgId: string): Promise<void> {
    const result = await this.invites().update(
      { id, organizationId: orgId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!result.affected) throw new NotFoundException('Invite link not found');
  }

  private async isMember(userId: string, orgId: string): Promise<boolean> {
    const [owner, staff] = await Promise.all([
      this.dataSource
        .getRepository(OrganizationOwnership)
        .exists({ where: { userId, organizationId: orgId } }),
      this.dataSource
        .getRepository(EmployeeOrgLocationAssignment)
        .exists({ where: { userId, organizationId: orgId } }),
    ]);
    return owner || staff;
  }
}
