import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { User } from 'src/user/entities/user.entity';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { isUniqueViolation, labError } from '../common/lab-errors';
import { AddLabMemberDto, UpdateLabMemberDto } from '../dto/lab.dto';
import { Lab } from '../entities/lab.entity';
import { LabMember } from '../entities/lab-member.entity';
import { LAB_ENTITY, LabType } from '../enums/lab.enums';
import {
  LabMemberResponse,
  MEMBER_AUDIT_FIELDS,
  toMemberResponse,
} from '../mappers/lab-response';

const MEMBER_UNIQUE = 'uq_lab_members_lab_user';

/**
 * Lab staff, managed by super admins. Members are deactivated, never
 * deleted. Lab-side access is resolved from active rows only.
 */
@Injectable()
export class LabMembersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(labId: string): Promise<LabMemberResponse[]> {
    await this.findLab(this.dataSource.manager, labId);
    const rows = await this.dataSource.getRepository(LabMember).find({
      where: { labId },
      relations: { user: true },
      order: { isActive: 'DESC', createdAt: 'ASC' },
    });
    return rows.map(toMemberResponse);
  }

  async add(
    labId: string,
    dto: AddLabMemberDto,
    actor: ActorRef,
  ): Promise<LabMemberResponse> {
    return this.dataSource.transaction(async (m) => {
      const lab = await this.findLab(m, labId);
      const user = await m
        .getRepository(User)
        .createQueryBuilder('u')
        .where('lower(u.email) = :email', { email: dto.email })
        .andWhere('u.deleted_at IS NULL')
        .getOne();
      if (!user) {
        throw labError(
          'LAB_MEMBER_USER_NOT_FOUND',
          'No account uses this email. Create the user first, then add them here.',
        );
      }
      await this.assertMayJoin(m, lab, user);

      const repo = m.getRepository(LabMember);
      let member: LabMember;
      try {
        member = await repo.save(
          repo.create({
            labId,
            userId: user.uuid,
            role: dto.role,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          }),
        );
      } catch (err) {
        if (isUniqueViolation(err, MEMBER_UNIQUE)) {
          throw labError(
            'LAB_MEMBER_EXISTS',
            'This user is already a member of this lab',
          );
        }
        throw err;
      }
      await this.audit.record(m, actor, {
        organizationId: lab.ownerOrganizationId,
        entityType: LAB_ENTITY.LAB_MEMBER,
        entityId: member.id,
        action: AuditAction.CREATE,
        after: snapshotOf(member, MEMBER_AUDIT_FIELDS),
      });
      return this.load(m, member.id);
    });
  }

  async update(
    labId: string,
    memberId: string,
    dto: UpdateLabMemberDto,
    actor: ActorRef,
  ): Promise<LabMemberResponse> {
    return this.dataSource.transaction(async (m) => {
      const lab = await this.findLab(m, labId);
      const member = await m.getRepository(LabMember).findOne({
        where: { id: memberId, labId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!member) throw labError('LAB_MEMBER_NOT_FOUND', 'Member not found');
      assertVersion(member.version, dto.version);

      const before = snapshotOf(member, MEMBER_AUDIT_FIELDS);
      if (dto.role !== undefined) member.role = dto.role;
      if (dto.isActive !== undefined) member.isActive = dto.isActive;

      const changed = await this.audit.record(m, actor, {
        organizationId: lab.ownerOrganizationId,
        entityType: LAB_ENTITY.LAB_MEMBER,
        entityId: member.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(member, MEMBER_AUDIT_FIELDS),
      });
      if (changed) {
        member.updatedBy = actor.userId;
        await m.getRepository(LabMember).save(member);
      }
      return this.load(m, member.id);
    });
  }

  /**
   * Lab users hold no clinic membership (lab ERD §7), so a clinic query can
   * never return their data. Staff of an internal lab may additionally work
   * for the clinic that owns it — nowhere else. Platform admins stay out.
   */
  private async assertMayJoin(
    m: EntityManager,
    lab: Lab,
    user: User,
  ): Promise<void> {
    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      throw labError(
        'LAB_MEMBER_NOT_ALLOWED',
        'Platform admins cannot be lab members',
      );
    }
    const orgs = await sqlRows<{ organization_id: string }>(
      m,
      `SELECT organization_id FROM organization_ownership WHERE user_id = $1
       UNION
       SELECT organization_id FROM employee_org_location_assignments
        WHERE user_id = $1 AND is_active`,
      [user.uuid],
    );
    const foreign = orgs.filter(
      (o) =>
        lab.labType === LabType.EXTERNAL ||
        o.organization_id !== lab.ownerOrganizationId,
    );
    if (foreign.length) {
      throw labError(
        'LAB_MEMBER_NOT_ALLOWED',
        lab.labType === LabType.EXTERNAL
          ? 'This account belongs to clinic staff. External lab staff need their own account.'
          : "This account belongs to another clinic's staff.",
      );
    }
  }

  private async findLab(m: EntityManager, labId: string): Promise<Lab> {
    const lab = await m.getRepository(Lab).findOneBy({ id: labId });
    if (!lab) throw labError('LAB_NOT_FOUND', 'Lab not found');
    return lab;
  }

  private async load(m: EntityManager, id: string): Promise<LabMemberResponse> {
    const member = await m.getRepository(LabMember).findOneOrFail({
      where: { id },
      relations: { user: true },
    });
    return toMemberResponse(member);
  }
}
