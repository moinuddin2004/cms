import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService } from 'src/common/audit/audit.service';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { Organization } from 'src/organizations/entities/organization.entity';
import { engineError } from '../common/engine-errors';
import {
  CreateStageTemplateDto,
  ListStageTemplatesQueryDto,
  StageStepDto,
  UpdateStageTemplateDto,
} from '../dto/engine.dto';
import { Specialty } from '../entities/specialty.entity';
import {
  StageTemplate,
  StageTemplateStep,
} from '../entities/stage-template.entity';
import { ENGINE_ENTITY } from '../enums/engine.enums';

export interface StageTemplateResponse {
  id: string;
  specialty: { id: string; code: string };
  organization: { id: string; name: string } | null;
  code: string;
  name: string;
  isActive: boolean;
  steps: {
    seq: number;
    code: string;
    name: string;
    requiresPatientVisit: boolean;
    requiresDoctorApproval: boolean;
    defaultLabDays: number;
  }[];
  version: number;
}

const stepFields = (s: StageTemplateStep | StageStepDto) => ({
  code: s.code,
  name: s.name,
  requiresPatientVisit: s.requiresPatientVisit,
  requiresDoctorApproval: s.requiresDoctorApproval,
  defaultLabDays: s.defaultLabDays,
});

/**
 * Stage templates (try-in sequences) — platform admins only. Not versioned:
 * orders copy step names and settings into their own stage rows when work
 * starts, so editing a template only affects work that starts later.
 */
@Injectable()
export class StageTemplatesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListStageTemplatesQueryDto): Promise<StageTemplateResponse[]> {
    const templates = await this.dataSource.getRepository(StageTemplate).find({
      where: q.specialtyId ? { specialtyId: q.specialtyId } : {},
      relations: { specialty: true, organization: true },
      order: { code: 'ASC' },
    });
    return Promise.all(
      templates.map((t) => this.respond(this.dataSource.manager, t)),
    );
  }

  async get(id: string): Promise<StageTemplateResponse> {
    const t = await this.dataSource.getRepository(StageTemplate).findOne({
      where: { id },
      relations: { specialty: true, organization: true },
    });
    if (!t)
      throw engineError('STAGE_TEMPLATE_NOT_FOUND', 'Stage template not found');
    return this.respond(this.dataSource.manager, t);
  }

  async create(
    dto: CreateStageTemplateDto,
    actor: ActorRef,
  ): Promise<StageTemplateResponse> {
    const id = await this.dataSource.transaction(
      async (m) =>
        (
          await this.createInTx(m, actor, {
            specialtyId: dto.specialtyId,
            organizationId: dto.organizationId ?? null,
            code: dto.code,
            name: dto.name,
            steps: dto.steps,
          })
        ).id,
    );
    return this.get(id);
  }

  async createInTx(
    m: EntityManager,
    actor: ActorRef,
    input: {
      specialtyId: string;
      organizationId: string | null;
      code: string;
      name: string;
      steps: StageStepDto[];
    },
  ): Promise<StageTemplate> {
    this.checkSteps(input.steps);
    if (
      !(await m.getRepository(Specialty).existsBy({ id: input.specialtyId }))
    ) {
      throw engineError('SPECIALTY_NOT_FOUND', 'Specialty not found');
    }
    if (
      input.organizationId &&
      !(await m
        .getRepository(Organization)
        .existsBy({ id: input.organizationId }))
    ) {
      throw engineError('ORGANIZATION_NOT_FOUND', 'Organization not found');
    }
    const repo = m.getRepository(StageTemplate);
    if (
      await repo.existsBy({
        specialtyId: input.specialtyId,
        code: input.code,
        organizationId: input.organizationId ?? IsNull(),
      })
    ) {
      throw engineError(
        'STAGE_TEMPLATE_EXISTS',
        `A ${input.code} stage template already exists here`,
      );
    }
    const template = await repo.save(
      repo.create({
        specialtyId: input.specialtyId,
        organizationId: input.organizationId,
        code: input.code,
        name: input.name,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      }),
    );
    await this.writeSteps(m, template.id, input.steps);
    await this.audit.record(m, actor, {
      organizationId: input.organizationId,
      entityType: ENGINE_ENTITY.STAGE_TEMPLATE,
      entityId: template.id,
      action: AuditAction.CREATE,
      after: {
        code: input.code,
        name: input.name,
        steps: input.steps.map(stepFields),
      },
    });
    return template;
  }

  async update(
    id: string,
    dto: UpdateStageTemplateDto,
    actor: ActorRef,
  ): Promise<StageTemplateResponse> {
    await this.dataSource.transaction(async (m) => {
      const t = await m.getRepository(StageTemplate).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!t)
        throw engineError(
          'STAGE_TEMPLATE_NOT_FOUND',
          'Stage template not found',
        );
      assertVersion(t.version, dto.version);
      if (dto.steps) this.checkSteps(dto.steps);

      const oldSteps = (await this.steps(m, id)).map(stepFields);
      const before = {
        ...snapshotOf(t, ['name', 'isActive']),
        steps: oldSteps,
      };
      if (dto.name !== undefined) t.name = dto.name;
      if (dto.isActive !== undefined) t.isActive = dto.isActive;
      const after = {
        ...snapshotOf(t, ['name', 'isActive']),
        steps: dto.steps ? dto.steps.map(stepFields) : oldSteps,
      };
      const changed = await this.audit.record(m, actor, {
        organizationId: t.organizationId,
        entityType: ENGINE_ENTITY.STAGE_TEMPLATE,
        entityId: id,
        action: AuditAction.UPDATE,
        before,
        after,
      });
      if (!changed) return;
      if (dto.steps) {
        await m
          .getRepository(StageTemplateStep)
          .delete({ stageTemplateId: id });
        await this.writeSteps(m, id, dto.steps);
      }
      t.updatedBy = actor.userId;
      // Bumps the version even when only the steps changed.
      t.updatedAt = new Date();
      await m.getRepository(StageTemplate).save(t);
    });
    return this.get(id);
  }

  private checkSteps(steps: StageStepDto[]): void {
    const codes = steps.map((s) => s.code);
    if (new Set(codes).size !== codes.length) {
      throw engineError('STAGE_TEMPLATE_INVALID', 'Step codes must be unique');
    }
    const last = steps[steps.length - 1];
    if (!last.requiresDoctorApproval) {
      throw engineError(
        'STAGE_TEMPLATE_INVALID',
        'The last step delivers the work — it needs the doctor’s approval',
      );
    }
  }

  private async writeSteps(
    m: EntityManager,
    templateId: string,
    steps: StageStepDto[],
  ) {
    await m.getRepository(StageTemplateStep).insert(
      steps.map((s, i) => ({
        stageTemplateId: templateId,
        seq: i + 1,
        ...stepFields(s),
      })),
    );
  }

  private steps(
    m: EntityManager,
    templateId: string,
  ): Promise<StageTemplateStep[]> {
    return m.getRepository(StageTemplateStep).find({
      where: { stageTemplateId: templateId },
      order: { seq: 'ASC' },
    });
  }

  private async respond(
    m: EntityManager,
    t: StageTemplate,
  ): Promise<StageTemplateResponse> {
    const steps = await this.steps(m, t.id);
    return {
      id: t.id,
      specialty: { id: t.specialty.id, code: t.specialty.code },
      organization: t.organization
        ? { id: t.organization.id, name: t.organization.name }
        : null,
      code: t.code,
      name: t.name,
      isActive: t.isActive,
      steps: steps.map((s) => ({ seq: s.seq, ...stepFields(s) })),
      version: t.version,
    };
  }
}
