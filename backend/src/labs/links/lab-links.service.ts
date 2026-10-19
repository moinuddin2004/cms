import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import {
  ActorRef,
  AuditAction,
  TransitionVia,
} from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { isUniqueViolation, labError } from '../common/lab-errors';
import { likePattern } from '../common/lab-query';
import {
  CreateLabLinkDto,
  LabDirectoryQueryDto,
  LabLinkTransitionDto,
  ListLabLinksQueryDto,
  UpdateLabLinkDto,
} from '../dto/lab.dto';
import { Lab } from '../entities/lab.entity';
import { LabClinicLink } from '../entities/lab-clinic-link.entity';
import {
  LAB_ENTITY,
  LabLinkStatus,
  LabStatus,
  LabType,
  PatientDataLevel,
} from '../enums/lab.enums';
import { DEFAULT_PAYMENT_TERMS_DAYS } from '../labs.constants';
import {
  DirectoryLab,
  LabLinkResponse,
  LINK_AUDIT_FIELDS,
  toLabSummary,
  toLinkResponse,
} from '../mappers/lab-response';
import {
  canLiftSuspension,
  LabLinkAction,
  resolveLinkTransition,
} from './lab-link-transitions';

const LINK_UNIQUE = 'uq_lab_clinic_links_lab_org';

export interface NewLink {
  lab: Lab;
  organizationId: string;
  status: LabLinkStatus.INVITED | LabLinkStatus.ACTIVE;
  paymentTermsDays?: number;
  patientDataLevel?: PatientDataLevel;
  notes?: string | null;
}

/**
 * Lab ↔ clinic links, tenant-scoped: every read and write is filtered by the
 * caller's organization and other tenants' ids answer 404. Status changes
 * go through `transition()` only and are written to `status_history`.
 */
@Injectable()
export class LabLinksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(
    organizationId: string,
    q: ListLabLinksQueryDto,
  ): Promise<PaginatedResponseDto<LabLinkResponse>> {
    const qb = this.dataSource
      .getRepository(LabClinicLink)
      .createQueryBuilder('k')
      .innerJoinAndSelect('k.lab', 'lab')
      .where('k.organization_id = :organizationId', { organizationId })
      .orderBy('lab.name', 'ASC')
      .addOrderBy('k.id', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.status) qb.andWhere('k.status = :status', { status: q.status });
    if (q.search) {
      const term = likePattern(q.search);
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('lab.name ILIKE :term', { term })
            .orWhere('lab.city ILIKE :term', { term })
            .orWhere('lab.phone ILIKE :term', { term }),
        ),
      );
    }
    const [rows, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(
      rows.map(toLinkResponse),
      total,
      q.page,
      q.limit,
    );
  }

  async get(organizationId: string, id: string): Promise<LabLinkResponse> {
    const link = await this.dataSource.getRepository(LabClinicLink).findOne({
      where: { id, organizationId },
      relations: { lab: true },
    });
    if (!link) throw labError('LAB_LINK_NOT_FOUND', 'Lab link not found');
    return toLinkResponse(link);
  }

  /**
   * Labs this clinic may link: active external labs plus its own internal
   * labs — never another clinic's internal lab.
   */
  async directory(
    organizationId: string,
    q: LabDirectoryQueryDto,
  ): Promise<DirectoryLab[]> {
    const qb = this.dataSource
      .getRepository(Lab)
      .createQueryBuilder('lab')
      .leftJoinAndMapOne(
        'lab.clinicLink',
        LabClinicLink,
        'k',
        'k.lab_id = lab.id AND k.organization_id = :organizationId',
        { organizationId },
      )
      .where('lab.status = :active', { active: LabStatus.ACTIVE })
      .andWhere(
        new Brackets((w) =>
          w
            .where('lab.lab_type = :external', { external: LabType.EXTERNAL })
            .orWhere('lab.owner_organization_id = :organizationId', {
              organizationId,
            }),
        ),
      )
      .orderBy('lab.name', 'ASC')
      .take(25);
    if (q.search) {
      const term = likePattern(q.search);
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('lab.name ILIKE :term', { term })
            .orWhere('lab.city ILIKE :term', { term }),
        ),
      );
    }
    const labs = (await qb.getMany()) as Array<
      Lab & { clinicLink?: LabClinicLink | null }
    >;
    return labs.map((lab) => ({
      ...toLabSummary(lab),
      link: lab.clinicLink
        ? { id: lab.clinicLink.id, status: lab.clinicLink.status }
        : null,
    }));
  }

  async create(
    organizationId: string,
    dto: CreateLabLinkDto,
    actor: ActorRef,
  ): Promise<LabLinkResponse> {
    return this.dataSource.transaction(async (m) => {
      const lab = await m.getRepository(Lab).findOne({
        where: { id: dto.labId },
        lock: { mode: 'pessimistic_read' },
      });
      // Another clinic's internal lab is reported as missing, not forbidden.
      if (
        !lab ||
        (lab.labType === LabType.INTERNAL &&
          lab.ownerOrganizationId !== organizationId)
      ) {
        throw labError('LAB_NOT_FOUND', 'Lab not found');
      }
      if (lab.status !== LabStatus.ACTIVE) {
        throw labError(
          'LAB_SUSPENDED',
          'This lab is suspended on the platform',
        );
      }
      const link = await this.createInTx(m, actor, {
        lab,
        organizationId,
        status: LabLinkStatus.INVITED,
        paymentTermsDays: dto.paymentTermsDays,
        patientDataLevel: dto.patientDataLevel,
        notes: dto.notes,
      });
      return toLinkResponse(link);
    });
  }

  /**
   * Inserts a link with its creation history. Runs in the caller's
   * transaction; also used by the platform when it creates an internal lab.
   */
  async createInTx(
    m: EntityManager,
    actor: ActorRef,
    input: NewLink,
  ): Promise<LabClinicLink> {
    const repo = m.getRepository(LabClinicLink);
    const now = new Date();
    let link: LabClinicLink;
    try {
      link = await repo.save(
        repo.create({
          labId: input.lab.id,
          organizationId: input.organizationId,
          status: input.status,
          paymentTermsDays:
            input.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS,
          patientDataLevel:
            input.patientDataLevel ?? PatientDataLevel.FULL_NAME,
          notes: input.notes ?? null,
          activatedAt: input.status === LabLinkStatus.ACTIVE ? now : null,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        }),
      );
    } catch (err) {
      if (isUniqueViolation(err, LINK_UNIQUE)) {
        throw labError(
          'LAB_LINK_EXISTS',
          'This lab is already in your lab list',
        );
      }
      throw err;
    }
    link.lab = input.lab;

    await this.audit.record(m, actor, {
      organizationId: input.organizationId,
      entityType: LAB_ENTITY.LAB_CLINIC_LINK,
      entityId: link.id,
      action: AuditAction.CREATE,
      after: snapshotOf(link, LINK_AUDIT_FIELDS),
    });
    await this.audit.recordStatus(m, actor, {
      organizationId: input.organizationId,
      entityType: LAB_ENTITY.LAB_CLINIC_LINK,
      entityId: link.id,
      fromState: null,
      toState: link.status,
      actionCode:
        input.status === LabLinkStatus.ACTIVE ? 'create_active' : 'invite',
    });
    return link;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateLabLinkDto,
    actor: ActorRef,
  ): Promise<LabLinkResponse> {
    return this.dataSource.transaction(async (m) => {
      const link = await this.lockLink(m, organizationId, id);
      assertVersion(link.version, dto.version);
      const before = snapshotOf(link, LINK_AUDIT_FIELDS);

      if (dto.paymentTermsDays !== undefined)
        link.paymentTermsDays = dto.paymentTermsDays;
      if (dto.patientDataLevel !== undefined)
        link.patientDataLevel = dto.patientDataLevel;
      if (dto.notes !== undefined) link.notes = dto.notes;

      const after = snapshotOf(link, LINK_AUDIT_FIELDS);
      const changed = await this.audit.record(m, actor, {
        organizationId,
        entityType: LAB_ENTITY.LAB_CLINIC_LINK,
        entityId: link.id,
        action: AuditAction.UPDATE,
        before,
        after,
      });
      if (changed) {
        link.updatedBy = actor.userId;
        await m.getRepository(LabClinicLink).save(link);
      }
      return toLinkResponse(await this.reload(m, link.id));
    });
  }

  async transition(
    organizationId: string,
    id: string,
    dto: LabLinkTransitionDto,
    actor: ActorRef,
  ): Promise<LabLinkResponse> {
    return this.dataSource.transaction(async (m) => {
      const link = await this.lockLink(m, organizationId, id);
      assertVersion(link.version, dto.version);
      await this.applyTransition(
        m,
        link,
        dto.action,
        actor,
        dto.reason ?? null,
      );
      return toLinkResponse(await this.reload(m, link.id));
    });
  }

  /** The single place a link's status changes. `link` must be row-locked. */
  async applyTransition(
    m: EntityManager,
    link: LabClinicLink,
    action: LabLinkAction,
    actor: ActorRef,
    reason: string | null,
    via: TransitionVia = TransitionVia.APP,
  ): Promise<void> {
    const from = link.status;
    const to = resolveLinkTransition(from, action, actor.side, reason);

    if (to === LabLinkStatus.ACTIVE) {
      const lab = await m
        .getRepository(Lab)
        .findOneByOrFail({ id: link.labId });
      if (lab.status !== LabStatus.ACTIVE) {
        throw labError(
          'LAB_SUSPENDED',
          'This lab is suspended on the platform',
        );
      }
    }
    if (action === 'reactivate') {
      const suspendedBy = await this.audit.lastTransitionSide(
        m,
        LAB_ENTITY.LAB_CLINIC_LINK,
        link.id,
        LabLinkStatus.SUSPENDED,
      );
      if (!canLiftSuspension(suspendedBy, actor.side)) {
        throw labError(
          'LAB_LINK_SUSPENDED_BY_OTHER_SIDE',
          `This link was suspended by the ${suspendedBy}; only they can reactivate it`,
        );
      }
    }

    const before = snapshotOf(link, LINK_AUDIT_FIELDS);
    link.status = to;
    if (to === LabLinkStatus.ACTIVE && !link.activatedAt) {
      link.activatedAt = new Date();
    }
    link.updatedBy = actor.userId;
    await m.getRepository(LabClinicLink).save(link);

    await this.audit.recordStatus(m, actor, {
      organizationId: link.organizationId,
      entityType: LAB_ENTITY.LAB_CLINIC_LINK,
      entityId: link.id,
      fromState: from,
      toState: to,
      actionCode: action,
      via,
      reason,
    });
    await this.audit.record(m, actor, {
      organizationId: link.organizationId,
      entityType: LAB_ENTITY.LAB_CLINIC_LINK,
      entityId: link.id,
      action: AuditAction.UPDATE,
      before,
      after: snapshotOf(link, LINK_AUDIT_FIELDS),
    });
  }

  async history(organizationId: string, id: string): Promise<TimelineEntry[]> {
    const exists = await this.dataSource
      .getRepository(LabClinicLink)
      .existsBy({ id, organizationId });
    if (!exists) throw labError('LAB_LINK_NOT_FOUND', 'Lab link not found');
    return this.audit.timeline(
      this.dataSource.manager,
      LAB_ENTITY.LAB_CLINIC_LINK,
      id,
      organizationId,
    );
  }

  private async lockLink(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<LabClinicLink> {
    const link = await m.getRepository(LabClinicLink).findOne({
      where: { id, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!link) throw labError('LAB_LINK_NOT_FOUND', 'Lab link not found');
    return link;
  }

  private reload(m: EntityManager, id: string): Promise<LabClinicLink> {
    return m.getRepository(LabClinicLink).findOneOrFail({
      where: { id },
      relations: { lab: true },
    });
  }
}
