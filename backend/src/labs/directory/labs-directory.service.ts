import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { Organization } from 'src/organizations/entities/organization.entity';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { labError } from '../common/lab-errors';
import { labCounts, likePattern } from '../common/lab-query';
import {
  CreateLabDto,
  ListLabsQueryDto,
  SetLabStatusDto,
  UpdateLabDto,
} from '../dto/lab.dto';
import { Lab } from '../entities/lab.entity';
import { LabClinicLink } from '../entities/lab-clinic-link.entity';
import { LAB_ENTITY, LabLinkStatus, LabType } from '../enums/lab.enums';
import { LabLinksService } from '../links/lab-links.service';
import { LabEmailVerificationService } from './lab-email-verification.service';
import {
  LAB_AUDIT_FIELDS,
  LabLinkAdminResponse,
  LabResponse,
  toLabResponse,
  toLinkAdminResponse,
} from '../mappers/lab-response';

const EDITABLE_FIELDS = [
  'name',
  'phone',
  'whatsappPhone',
  'email',
  'city',
  'address',
] as const;

/**
 * The platform lab directory, managed by super admins (our team). Labs are
 * platform-level, so these reads are not tenant-scoped — the controller is
 * super-admin only. Creating an internal lab also links it to its owner.
 */
@Injectable()
export class LabsDirectoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly linksService: LabLinksService,
    private readonly emailVerification: LabEmailVerificationService,
  ) {}

  async list(q: ListLabsQueryDto): Promise<PaginatedResponseDto<LabResponse>> {
    const qb = this.dataSource
      .getRepository(Lab)
      .createQueryBuilder('lab')
      .leftJoinAndSelect('lab.ownerOrganization', 'owner')
      .orderBy('lab.name', 'ASC')
      .addOrderBy('lab.id', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.status) qb.andWhere('lab.status = :status', { status: q.status });
    if (q.labType)
      qb.andWhere('lab.lab_type = :labType', { labType: q.labType });
    if (q.search) {
      const term = likePattern(q.search);
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('lab.name ILIKE :term', { term })
            .orWhere('lab.city ILIKE :term', { term })
            .orWhere('lab.phone ILIKE :term', { term })
            .orWhere('lab.email ILIKE :term', { term }),
        ),
      );
    }
    const [labs, total] = await qb.getManyAndCount();
    const counts = await labCounts(
      this.dataSource.manager,
      labs.map((l) => l.id),
    );
    return PaginatedResponseDto.create(
      labs.map((l) => toLabResponse(l, counts.get(l.id)!)),
      total,
      q.page,
      q.limit,
    );
  }

  async get(id: string): Promise<LabResponse> {
    return this.load(this.dataSource.manager, id);
  }

  async create(dto: CreateLabDto, actor: ActorRef): Promise<LabResponse> {
    const internal = dto.labType === LabType.INTERNAL;
    if (!internal && dto.ownerOrganizationId) {
      throw labError(
        'LAB_OWNER_INVALID',
        'Only internal labs belong to an organization',
      );
    }

    const created = await this.dataSource.transaction(async (m) => {
      const ownerOrganizationId = internal ? dto.ownerOrganizationId! : null;
      if (ownerOrganizationId) {
        const owner = await m
          .getRepository(Organization)
          .existsBy({ id: ownerOrganizationId });
        if (!owner) {
          throw labError('LAB_OWNER_ORG_NOT_FOUND', 'Organization not found');
        }
      }

      const repo = m.getRepository(Lab);
      const lab = await repo.save(
        repo.create({
          labType: dto.labType,
          ownerOrganizationId,
          name: dto.name,
          phone: dto.phone ?? null,
          whatsappPhone: dto.whatsappPhone ?? null,
          email: dto.email ?? null,
          city: dto.city ?? null,
          address: dto.address ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        }),
      );
      await this.audit.record(m, actor, {
        organizationId: ownerOrganizationId,
        entityType: LAB_ENTITY.LAB,
        entityId: lab.id,
        action: AuditAction.CREATE,
        after: snapshotOf(lab, LAB_AUDIT_FIELDS),
      });

      // An internal lab only ever serves its owner — link it straight away.
      if (ownerOrganizationId) {
        await this.linksService.createInTx(m, actor, {
          lab,
          organizationId: ownerOrganizationId,
          status: LabLinkStatus.ACTIVE,
        });
      }
      return this.load(m, lab.id);
    });
    // After commit: the new address gets its confirmation link.
    if (created.email) await this.emailVerification.start(created.id);
    return created;
  }

  async update(
    id: string,
    dto: UpdateLabDto,
    actor: ActorRef,
  ): Promise<LabResponse> {
    let emailChanged = false;
    const updated = await this.dataSource.transaction(async (m) => {
      const lab = await this.lock(m, id);
      assertVersion(lab.version, dto.version);
      const before = snapshotOf(lab, LAB_AUDIT_FIELDS);
      const previousEmail = (lab.email ?? '').trim().toLowerCase();
      for (const f of EDITABLE_FIELDS) {
        const value = dto[f];
        if (value !== undefined)
          (lab as unknown as Record<string, unknown>)[f] = value;
      }
      emailChanged = (lab.email ?? '').trim().toLowerCase() !== previousEmail;
      // A new (or removed) address is unconfirmed until its link is clicked.
      if (emailChanged) lab.emailVerifiedAt = null;
      await this.saveAudited(m, lab, before, actor);
      return this.load(m, id);
    });
    if (emailChanged && updated.email) {
      await this.emailVerification.start(updated.id);
    }
    return updated;
  }

  /** Suspending a lab blocks new links and activations; existing links stay. */
  async setStatus(
    id: string,
    dto: SetLabStatusDto,
    actor: ActorRef,
  ): Promise<LabResponse> {
    return this.dataSource.transaction(async (m) => {
      const lab = await this.lock(m, id);
      assertVersion(lab.version, dto.version);
      const before = snapshotOf(lab, LAB_AUDIT_FIELDS);
      lab.status = dto.status;
      await this.saveAudited(m, lab, before, actor);
      return this.load(m, id);
    });
  }

  async links(id: string): Promise<LabLinkAdminResponse[]> {
    await this.assertExists(id);
    const rows = await this.dataSource.getRepository(LabClinicLink).find({
      where: { labId: id },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toLinkAdminResponse);
  }

  async history(id: string): Promise<TimelineEntry[]> {
    await this.assertExists(id);
    return this.audit.timeline(
      this.dataSource.manager,
      LAB_ENTITY.LAB,
      id,
      null,
    );
  }

  private async saveAudited(
    m: EntityManager,
    lab: Lab,
    before: Record<string, unknown>,
    actor: ActorRef,
  ): Promise<void> {
    const changed = await this.audit.record(m, actor, {
      organizationId: lab.ownerOrganizationId,
      entityType: LAB_ENTITY.LAB,
      entityId: lab.id,
      action: AuditAction.UPDATE,
      before,
      after: snapshotOf(lab, LAB_AUDIT_FIELDS),
    });
    if (!changed) return;
    lab.updatedBy = actor.userId;
    await m.getRepository(Lab).save(lab);
  }

  private async lock(m: EntityManager, id: string): Promise<Lab> {
    const lab = await m.getRepository(Lab).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lab) throw labError('LAB_NOT_FOUND', 'Lab not found');
    return lab;
  }

  private async assertExists(id: string): Promise<void> {
    if (!(await this.dataSource.getRepository(Lab).existsBy({ id }))) {
      throw labError('LAB_NOT_FOUND', 'Lab not found');
    }
  }

  private async load(m: EntityManager, id: string): Promise<LabResponse> {
    const lab = await m.getRepository(Lab).findOne({
      where: { id },
      relations: { ownerOrganization: true },
    });
    if (!lab) throw labError('LAB_NOT_FOUND', 'Lab not found');
    const counts = await labCounts(m, [id]);
    return toLabResponse(lab, counts.get(id)!);
  }
}
