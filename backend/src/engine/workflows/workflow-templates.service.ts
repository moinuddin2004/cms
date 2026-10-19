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
  CreateDraftDto,
  CreateWorkflowTemplateDto,
  ListWorkflowTemplatesQueryDto,
  UpdateWorkflowDraftDto,
  UpdateWorkflowTemplateDto,
} from '../dto/engine.dto';
import { Specialty } from '../entities/specialty.entity';
import { TransitionEffect } from '../entities/workflow-effect.entity';
import { WorkflowState } from '../entities/workflow-state.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { WorkflowTemplateVersion } from '../entities/workflow-template-version.entity';
import { WorkflowTransition } from '../entities/workflow-transition.entity';
import { DefinitionStatus, ENGINE_ENTITY } from '../enums/engine.enums';
import { EffectRegistry } from '../runtime/effect-registry';
import {
  checkWorkflow,
  isTerminal,
  simulateWorkflow,
} from './workflow-definition.checker';
import {
  WorkflowTemplateDetail,
  WorkflowTemplateSummary,
  WorkflowVersionResponse,
} from './workflow-responses';
import type {
  DefinitionIssue,
  WorkflowDefinition,
  WorkflowEntityType,
} from './workflow.types';

const TEMPLATE_AUDIT_FIELDS = [
  'specialtyId',
  'organizationId',
  'entityType',
  'code',
  'name',
  'description',
  'isActive',
] as const satisfies readonly (keyof WorkflowTemplate)[];

const EMPTY: WorkflowDefinition = { states: [], transitions: [] };

const invalid = (issues: DefinitionIssue[]) =>
  engineError(
    'WORKFLOW_DEFINITION_INVALID',
    `The workflow has ${issues.length} problem${issues.length === 1 ? '' : 's'} to fix before publishing`,
    { issues },
  );

export interface NewWorkflowInput {
  specialtyId: string;
  organizationId: string | null;
  entityType: WorkflowEntityType;
  code: string;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  publish: boolean;
}

/**
 * Workflow templates and versions — platform admins only (lab ERD §18).
 * Drafts hold their definition as JSON; publishing runs the §18 checks and
 * writes states, transitions and effects as rows the runtime reads. A
 * published version never changes; orders keep the version they started on.
 */
@Injectable()
export class WorkflowTemplatesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly effects: EffectRegistry,
  ) {}

  async list(
    q: ListWorkflowTemplatesQueryDto,
  ): Promise<WorkflowTemplateSummary[]> {
    const templates = await this.dataSource
      .getRepository(WorkflowTemplate)
      .find({
        where: {
          ...(q.specialtyId ? { specialtyId: q.specialtyId } : {}),
          ...(q.entityType ? { entityType: q.entityType } : {}),
          ...(q.owner === 'platform'
            ? { organizationId: IsNull() }
            : q.owner
              ? { organizationId: q.owner }
              : {}),
        },
        relations: { specialty: true, organization: true },
        order: { code: 'ASC', createdAt: 'ASC' },
      });
    return this.summaries(this.dataSource.manager, templates);
  }

  async get(id: string): Promise<WorkflowTemplateDetail> {
    const m = this.dataSource.manager;
    const template = await m.getRepository(WorkflowTemplate).findOne({
      where: { id },
      relations: { specialty: true, organization: true },
    });
    if (!template) throw this.notFound();
    const [summary] = await this.summaries(m, [template]);
    const versions = await m.getRepository(WorkflowTemplateVersion).find({
      where: { workflowTemplateId: id },
      order: { versionNo: 'DESC' },
    });
    return {
      ...summary,
      versions: versions.map((v) => ({
        id: v.id,
        versionNo: v.versionNo,
        status: v.status,
        publishedAt: v.publishedAt,
        retiredAt: v.retiredAt,
        createdAt: v.createdAt,
      })),
    };
  }

  async create(
    dto: CreateWorkflowTemplateDto,
    actor: ActorRef,
  ): Promise<WorkflowTemplateDetail> {
    const id = await this.dataSource.transaction(async (m) => {
      let definition = EMPTY;
      if (dto.copyFromVersionId) {
        const from = await m.getRepository(WorkflowTemplateVersion).findOne({
          where: { id: dto.copyFromVersionId },
          relations: { workflowTemplate: true },
        });
        if (!from) {
          throw engineError(
            'WORKFLOW_VERSION_NOT_FOUND',
            'Version to copy not found',
          );
        }
        if (from.workflowTemplate.entityType !== dto.entityType) {
          throw engineError(
            'WORKFLOW_DEFINITION_INVALID',
            `The copied version is a ${from.workflowTemplate.entityType} workflow`,
          );
        }
        definition = from.definitionJson;
      }
      const template = await this.createInTx(m, actor, {
        specialtyId: dto.specialtyId,
        organizationId: dto.organizationId ?? null,
        entityType: dto.entityType,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        definition,
        publish: false,
      });
      return template.id;
    });
    return this.get(id);
  }

  async createInTx(
    m: EntityManager,
    actor: ActorRef,
    input: NewWorkflowInput,
  ): Promise<WorkflowTemplate> {
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
    const repo = m.getRepository(WorkflowTemplate);
    if (
      await repo.existsBy({
        specialtyId: input.specialtyId,
        code: input.code,
        organizationId: input.organizationId ?? IsNull(),
      })
    ) {
      throw engineError(
        'WORKFLOW_TEMPLATE_EXISTS',
        `A ${input.code} workflow already exists here`,
      );
    }
    const template = await repo.save(
      repo.create({
        specialtyId: input.specialtyId,
        organizationId: input.organizationId,
        entityType: input.entityType,
        code: input.code,
        name: input.name,
        description: input.description,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      }),
    );
    await this.audit.record(m, actor, {
      organizationId: input.organizationId,
      entityType: ENGINE_ENTITY.WORKFLOW_TEMPLATE,
      entityId: template.id,
      action: AuditAction.CREATE,
      after: snapshotOf(template, TEMPLATE_AUDIT_FIELDS),
    });
    const version = await this.insertVersion(
      m,
      actor,
      template,
      1,
      input.definition,
    );
    if (input.publish) await this.publishInTx(m, actor, template, version);
    return template;
  }

  async update(
    id: string,
    dto: UpdateWorkflowTemplateDto,
    actor: ActorRef,
  ): Promise<WorkflowTemplateDetail> {
    await this.dataSource.transaction(async (m) => {
      const template = await this.lock(m, id);
      assertVersion(template.version, dto.version);
      const before = snapshotOf(template, TEMPLATE_AUDIT_FIELDS);
      if (dto.name !== undefined) template.name = dto.name;
      if (dto.description !== undefined) template.description = dto.description;
      if (dto.isActive !== undefined) template.isActive = dto.isActive;
      const changed = await this.audit.record(m, actor, {
        organizationId: template.organizationId,
        entityType: ENGINE_ENTITY.WORKFLOW_TEMPLATE,
        entityId: id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(template, TEMPLATE_AUDIT_FIELDS),
      });
      if (changed) {
        template.updatedBy = actor.userId;
        await m.getRepository(WorkflowTemplate).save(template);
      }
    });
    return this.get(id);
  }

  async getVersion(
    templateId: string,
    versionId: string,
  ): Promise<WorkflowVersionResponse> {
    return this.respond(
      await this.findVersion(this.dataSource.manager, templateId, versionId),
    );
  }

  async createDraft(
    templateId: string,
    dto: CreateDraftDto,
    actor: ActorRef,
  ): Promise<WorkflowVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const template = await this.lock(m, templateId);
      const repo = m.getRepository(WorkflowTemplateVersion);
      if (
        await repo.existsBy({
          workflowTemplateId: templateId,
          status: DefinitionStatus.DRAFT,
        })
      ) {
        throw engineError(
          'WORKFLOW_DRAFT_EXISTS',
          'This workflow already has a draft — edit or discard it first',
        );
      }
      const source = dto.fromVersionId
        ? await this.findVersion(m, templateId, dto.fromVersionId)
        : await repo.findOne({
            where: { workflowTemplateId: templateId },
            order: { versionNo: 'DESC' },
          });
      const latest = await repo.maximum('versionNo', {
        workflowTemplateId: templateId,
      });
      return this.insertVersion(
        m,
        actor,
        template,
        (latest ?? 0) + 1,
        source?.definitionJson ?? EMPTY,
      );
    });
    return this.respond(version);
  }

  /** Saves a draft's definition; issues come back, they don't block saving. */
  async updateDraft(
    templateId: string,
    versionId: string,
    dto: UpdateWorkflowDraftDto,
    actor: ActorRef,
  ): Promise<WorkflowVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const template = await this.lock(m, templateId);
      const v = await this.lockDraft(m, templateId, versionId);
      assertVersion(v.version, dto.version);
      const check = checkWorkflow(dto.definition, this.effects.codes());
      const before = { definition: v.definitionJson };
      v.definitionJson =
        check.definition ?? (dto.definition as unknown as WorkflowDefinition);
      const changed = await this.audit.record(m, actor, {
        organizationId: template.organizationId,
        entityType: ENGINE_ENTITY.WORKFLOW_VERSION,
        entityId: v.id,
        action: AuditAction.UPDATE,
        before,
        after: { definition: v.definitionJson },
      });
      if (changed) {
        v.updatedBy = actor.userId;
        await m.getRepository(WorkflowTemplateVersion).save(v);
      }
      return v;
    });
    return this.respond(version);
  }

  async publish(
    templateId: string,
    versionId: string,
    expectedVersion: number,
    actor: ActorRef,
  ): Promise<WorkflowVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const template = await this.lock(m, templateId);
      const v = await this.lockDraft(m, templateId, versionId);
      assertVersion(v.version, expectedVersion);
      return this.publishInTx(m, actor, template, v);
    });
    return this.respond(version);
  }

  async retire(
    templateId: string,
    versionId: string,
    expectedVersion: number,
    actor: ActorRef,
  ): Promise<WorkflowVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const template = await this.lock(m, templateId);
      const v = await this.findVersion(m, templateId, versionId, true);
      if (v.status !== DefinitionStatus.PUBLISHED) {
        throw engineError(
          'WORKFLOW_VERSION_NOT_PUBLISHED',
          'Only the published version can be retired',
        );
      }
      assertVersion(v.version, expectedVersion);
      await this.setStatus(m, actor, template, v, DefinitionStatus.RETIRED);
      return v;
    });
    return this.respond(version);
  }

  async discardDraft(
    templateId: string,
    versionId: string,
    actor: ActorRef,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const template = await this.lock(m, templateId);
      const v = await this.lockDraft(m, templateId, versionId);
      await m.getRepository(WorkflowTemplateVersion).delete({ id: v.id });
      // On the template: the version row is gone.
      await this.audit.record(m, actor, {
        organizationId: template.organizationId,
        entityType: ENGINE_ENTITY.WORKFLOW_TEMPLATE,
        entityId: template.id,
        action: AuditAction.VOID,
        before: {
          discardedDraft: {
            versionNo: v.versionNo,
            definition: v.definitionJson,
          },
        },
      });
    });
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async insertVersion(
    m: EntityManager,
    actor: ActorRef,
    template: WorkflowTemplate,
    versionNo: number,
    definition: WorkflowDefinition,
  ): Promise<WorkflowTemplateVersion> {
    const repo = m.getRepository(WorkflowTemplateVersion);
    const version = await repo.save(
      repo.create({
        workflowTemplateId: template.id,
        versionNo,
        definitionJson: definition,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      }),
    );
    await this.audit.record(m, actor, {
      organizationId: template.organizationId,
      entityType: ENGINE_ENTITY.WORKFLOW_VERSION,
      entityId: version.id,
      action: AuditAction.CREATE,
      after: { versionNo, definition },
    });
    return version;
  }

  /** Checks, materialises states/transitions/effects, retires the old version. */
  private async publishInTx(
    m: EntityManager,
    actor: ActorRef,
    template: WorkflowTemplate,
    v: WorkflowTemplateVersion,
  ): Promise<WorkflowTemplateVersion> {
    const check = checkWorkflow(v.definitionJson, this.effects.codes());
    if (check.issues.length) throw invalid(check.issues);
    const def = check.definition!;

    const states = await m.getRepository(WorkflowState).save(
      def.states.map((s, i) =>
        m.getRepository(WorkflowState).create({
          templateVersionId: v.id,
          code: s.code,
          name: s.name,
          category: s.category,
          isTerminal: isTerminal(s.category),
          sortOrder: i + 1,
        }),
      ),
    );
    const stateId = new Map(states.map((s) => [s.code, s.id]));
    for (const t of def.transitions) {
      const row = await m.getRepository(WorkflowTransition).save(
        m.getRepository(WorkflowTransition).create({
          templateVersionId: v.id,
          fromStateId: stateId.get(t.from)!,
          toStateId: stateId.get(t.to)!,
          actionCode: t.action,
          allowedRoles: t.allowedRoles ?? [],
          allowedSides: t.allowedSides,
          requiredFields: t.requiredFields ?? [],
          requiresReason: t.requiresReason ?? false,
        }),
      );
      if (t.effects?.length) {
        await m.getRepository(TransitionEffect).insert(
          t.effects.map((e, i) => ({
            transitionId: row.id,
            effectCode: e.code,
            seq: i + 1,
            params: (e.params ?? null) as never,
          })),
        );
      }
    }

    const current = await m.getRepository(WorkflowTemplateVersion).findOne({
      where: {
        workflowTemplateId: template.id,
        status: DefinitionStatus.PUBLISHED,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (current)
      await this.setStatus(
        m,
        actor,
        template,
        current,
        DefinitionStatus.RETIRED,
      );
    v.definitionJson = def;
    v.publishedAt = new Date();
    v.publishedBy = actor.userId;
    await this.setStatus(m, actor, template, v, DefinitionStatus.PUBLISHED);
    return v;
  }

  private async setStatus(
    m: EntityManager,
    actor: ActorRef,
    template: WorkflowTemplate,
    v: WorkflowTemplateVersion,
    status: DefinitionStatus,
  ): Promise<void> {
    const before = { status: v.status };
    v.status = status;
    if (status === DefinitionStatus.RETIRED) v.retiredAt = new Date();
    v.updatedBy = actor.userId;
    await m.getRepository(WorkflowTemplateVersion).save(v);
    await this.audit.record(m, actor, {
      organizationId: template.organizationId,
      entityType: ENGINE_ENTITY.WORKFLOW_VERSION,
      entityId: v.id,
      action: AuditAction.UPDATE,
      before,
      after: { status },
    });
  }

  private respond(v: WorkflowTemplateVersion): WorkflowVersionResponse {
    const check = checkWorkflow(v.definitionJson, this.effects.codes());
    return {
      id: v.id,
      workflowTemplateId: v.workflowTemplateId,
      versionNo: v.versionNo,
      status: v.status,
      definition: v.definitionJson,
      publishedAt: v.publishedAt,
      retiredAt: v.retiredAt,
      version: v.version,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      issues: v.status === DefinitionStatus.DRAFT ? check.issues : [],
      simulation: check.definition ? simulateWorkflow(check.definition) : [],
    };
  }

  private async summaries(
    m: EntityManager,
    templates: WorkflowTemplate[],
  ): Promise<WorkflowTemplateSummary[]> {
    if (!templates.length) return [];
    const live = await m
      .getRepository(WorkflowTemplateVersion)
      .createQueryBuilder('v')
      .where('v.workflow_template_id IN (:...ids)', {
        ids: templates.map((t) => t.id),
      })
      .andWhere('v.status IN (:...statuses)', {
        statuses: [DefinitionStatus.PUBLISHED, DefinitionStatus.DRAFT],
      })
      .getMany();
    return templates.map((t) => {
      const mine = live.filter((v) => v.workflowTemplateId === t.id);
      const current = mine.find((v) => v.status === DefinitionStatus.PUBLISHED);
      const draft = mine.find((v) => v.status === DefinitionStatus.DRAFT);
      return {
        id: t.id,
        specialty: {
          id: t.specialty.id,
          code: t.specialty.code,
          name: t.specialty.name,
        },
        organization: t.organization
          ? { id: t.organization.id, name: t.organization.name }
          : null,
        entityType: t.entityType,
        code: t.code,
        name: t.name,
        description: t.description,
        isActive: t.isActive,
        current: current
          ? {
              id: current.id,
              versionNo: current.versionNo,
              publishedAt: current.publishedAt!,
            }
          : null,
        draft: draft ? { id: draft.id, versionNo: draft.versionNo } : null,
        version: t.version,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });
  }

  private async lock(m: EntityManager, id: string): Promise<WorkflowTemplate> {
    const template = await m.getRepository(WorkflowTemplate).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!template) throw this.notFound();
    return template;
  }

  private async findVersion(
    m: EntityManager,
    templateId: string,
    versionId: string,
    lock = false,
  ): Promise<WorkflowTemplateVersion> {
    const v = await m.getRepository(WorkflowTemplateVersion).findOne({
      where: { id: versionId, workflowTemplateId: templateId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!v)
      throw engineError('WORKFLOW_VERSION_NOT_FOUND', 'Version not found');
    return v;
  }

  private async lockDraft(
    m: EntityManager,
    templateId: string,
    versionId: string,
  ): Promise<WorkflowTemplateVersion> {
    const v = await this.findVersion(m, templateId, versionId, true);
    if (v.status !== DefinitionStatus.DRAFT) {
      throw engineError(
        'WORKFLOW_VERSION_NOT_DRAFT',
        'Published versions never change — create a new draft instead',
      );
    }
    return v;
  }

  private notFound() {
    return engineError('WORKFLOW_TEMPLATE_NOT_FOUND', 'Workflow not found');
  }
}
