import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService, TimelineEntry } from 'src/common/audit/audit.service';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { Organization } from 'src/organizations/entities/organization.entity';
import { definitionInvalid, engineError } from '../common/engine-errors';
import {
  CreateDraftDto,
  CreateFormSchemaDto,
  ListFormSchemasQueryDto,
  UpdateDraftDto,
  UpdateFormSchemaDto,
} from '../dto/engine.dto';
import { FormSchema } from '../entities/form-schema.entity';
import { FormSchemaVersion } from '../entities/form-schema-version.entity';
import { Specialty } from '../entities/specialty.entity';
import { DefinitionStatus, ENGINE_ENTITY } from '../enums/engine.enums';
import { checkDefinition } from './form-definition.checker';
import { FormDataResult, validateFormData } from './form-data.validator';
import type {
  FormDefinition,
  FormIssue,
  FormUi,
  Promotions,
} from './form-definition.types';
import {
  FormSchemaDetail,
  FormSchemaSummary,
  FormVersionResponse,
  toVersionResponse,
} from './form-responses';

const SCHEMA_AUDIT_FIELDS = [
  'specialtyId',
  'organizationId',
  'code',
  'name',
  'description',
  'isActive',
] as const satisfies readonly (keyof FormSchema)[];

const VERSION_AUDIT_FIELDS = [
  'versionNo',
  'status',
  'schemaJson',
  'uiJson',
  'promotions',
] as const satisfies readonly (keyof FormSchemaVersion)[];

const EMPTY_DEFINITION: FormDefinition = { fields: [] };

export interface NewSchemaInput {
  specialtyId: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string | null;
  content: {
    schemaJson: FormDefinition;
    uiJson: FormUi | null;
    promotions: Promotions;
  };
  /** Seeds publish straight away; everything else starts as a draft. */
  publish: boolean;
}

/**
 * Form schemas and their versions — platform admins only (lab ERD §18:
 * Configuration Studio is platform-only in phase 1). A version moves
 * draft → published → retired; only a draft's content can change, and only
 * a definition with no issues can be published.
 */
@Injectable()
export class FormSchemasService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListFormSchemasQueryDto): Promise<FormSchemaSummary[]> {
    const where = {
      ...(q.specialtyId ? { specialtyId: q.specialtyId } : {}),
      ...(q.owner === 'platform'
        ? { organizationId: IsNull() }
        : q.owner
          ? { organizationId: q.owner }
          : {}),
    };
    const schemas = await this.dataSource.getRepository(FormSchema).find({
      where,
      relations: { specialty: true, organization: true },
      order: { code: 'ASC', createdAt: 'ASC' },
    });
    return this.summaries(this.dataSource.manager, schemas);
  }

  async get(id: string): Promise<FormSchemaDetail> {
    const m = this.dataSource.manager;
    const schema = await this.loadSchema(m, id);
    const [summary] = await this.summaries(m, [schema]);
    const versions = await m.getRepository(FormSchemaVersion).find({
      where: { formSchemaId: id },
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
    dto: CreateFormSchemaDto,
    actor: ActorRef,
  ): Promise<FormSchemaDetail> {
    const id = await this.dataSource.transaction(async (m) => {
      let content: NewSchemaInput['content'] = {
        schemaJson: EMPTY_DEFINITION,
        uiJson: null,
        promotions: {},
      };
      if (dto.copyFromVersionId) {
        const from = await m.getRepository(FormSchemaVersion).findOne({
          where: { id: dto.copyFromVersionId },
          relations: { formSchema: true },
        });
        if (!from) {
          throw engineError(
            'FORM_VERSION_NOT_FOUND',
            'Version to copy not found',
          );
        }
        if (from.formSchema.specialtyId !== dto.specialtyId) {
          throw engineError(
            'FORM_DEFINITION_INVALID',
            'The copied version belongs to another specialty',
          );
        }
        content = {
          schemaJson: from.schemaJson,
          uiJson: from.uiJson,
          promotions: from.promotions,
        };
      }
      const schema = await this.createInTx(m, actor, {
        specialtyId: dto.specialtyId,
        organizationId: dto.organizationId ?? null,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        content,
        publish: false,
      });
      return schema.id;
    });
    return this.get(id);
  }

  /** Creates a schema with version 1 (draft, or published for seeds). */
  async createInTx(
    m: EntityManager,
    actor: ActorRef,
    input: NewSchemaInput,
  ): Promise<FormSchema> {
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
    const repo = m.getRepository(FormSchema);
    const duplicate = await repo.existsBy({
      specialtyId: input.specialtyId,
      code: input.code,
      organizationId: input.organizationId ?? IsNull(),
    });
    if (duplicate) {
      throw engineError(
        'FORM_SCHEMA_EXISTS',
        `A ${input.code} form already exists here`,
      );
    }
    const schema = await repo.save(
      repo.create({
        specialtyId: input.specialtyId,
        organizationId: input.organizationId,
        code: input.code,
        name: input.name,
        description: input.description,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      }),
    );
    await this.audit.record(m, actor, {
      organizationId: input.organizationId,
      entityType: ENGINE_ENTITY.FORM_SCHEMA,
      entityId: schema.id,
      action: AuditAction.CREATE,
      after: snapshotOf(schema, SCHEMA_AUDIT_FIELDS),
    });

    let content = input.content;
    if (input.publish) {
      const check = checkDefinition(
        content.schemaJson,
        content.uiJson,
        content.promotions,
      );
      if (check.issues.length) throw definitionInvalid(check.issues);
      content = {
        ...content,
        schemaJson: check.definition!,
        promotions: check.promotions,
      };
    }
    const version = await this.insertVersion(m, actor, schema, 1, content);
    if (input.publish) await this.publishInTx(m, actor, schema, version);
    return schema;
  }

  async update(
    id: string,
    dto: UpdateFormSchemaDto,
    actor: ActorRef,
  ): Promise<FormSchemaDetail> {
    await this.dataSource.transaction(async (m) => {
      const schema = await this.lockSchema(m, id);
      assertVersion(schema.version, dto.version);
      const before = snapshotOf(schema, SCHEMA_AUDIT_FIELDS);
      if (dto.name !== undefined) schema.name = dto.name;
      if (dto.description !== undefined) schema.description = dto.description;
      if (dto.isActive !== undefined) schema.isActive = dto.isActive;
      const changed = await this.audit.record(m, actor, {
        organizationId: schema.organizationId,
        entityType: ENGINE_ENTITY.FORM_SCHEMA,
        entityId: id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(schema, SCHEMA_AUDIT_FIELDS),
      });
      if (changed) {
        schema.updatedBy = actor.userId;
        await m.getRepository(FormSchema).save(schema);
      }
    });
    return this.get(id);
  }

  async getVersion(
    schemaId: string,
    versionId: string,
  ): Promise<FormVersionResponse> {
    const version = await this.findVersion(
      this.dataSource.manager,
      schemaId,
      versionId,
    );
    return this.withIssues(version);
  }

  /** New draft — a copy of `fromVersionId` or of the newest version. */
  async createDraft(
    schemaId: string,
    dto: CreateDraftDto,
    actor: ActorRef,
  ): Promise<FormVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const schema = await this.lockSchema(m, schemaId);
      const repo = m.getRepository(FormSchemaVersion);
      if (
        await repo.existsBy({
          formSchemaId: schemaId,
          status: DefinitionStatus.DRAFT,
        })
      ) {
        throw engineError(
          'FORM_DRAFT_EXISTS',
          'This form already has a draft — edit or discard it first',
        );
      }
      const source = dto.fromVersionId
        ? await this.findVersion(m, schemaId, dto.fromVersionId)
        : await repo.findOne({
            where: { formSchemaId: schemaId },
            order: { versionNo: 'DESC' },
          });
      const latest = await repo.maximum('versionNo', {
        formSchemaId: schemaId,
      });
      return this.insertVersion(m, actor, schema, (latest ?? 0) + 1, {
        schemaJson: source?.schemaJson ?? EMPTY_DEFINITION,
        uiJson: source?.uiJson ?? null,
        promotions: source?.promotions ?? {},
      });
    });
    return this.withIssues(version);
  }

  /** Saves draft content; issues are returned, not thrown — drafts may be incomplete. */
  async updateDraft(
    schemaId: string,
    versionId: string,
    dto: UpdateDraftDto,
    actor: ActorRef,
  ): Promise<FormVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const schema = await this.lockSchema(m, schemaId);
      const v = await this.lockDraft(m, schemaId, versionId);
      assertVersion(v.version, dto.version);
      const before = snapshotOf(v, VERSION_AUDIT_FIELDS);

      const check = checkDefinition(dto.schemaJson, dto.uiJson, dto.promotions);
      // Store the normalised definition when readable, else exactly what was sent.
      v.schemaJson =
        check.definition ?? (dto.schemaJson as unknown as FormDefinition);
      v.uiJson = (dto.uiJson ?? null) as FormUi | null;
      v.promotions = (dto.promotions ?? {}) as Promotions;

      const changed = await this.audit.record(m, actor, {
        organizationId: schema.organizationId,
        entityType: ENGINE_ENTITY.FORM_SCHEMA_VERSION,
        entityId: v.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(v, VERSION_AUDIT_FIELDS),
      });
      if (changed) {
        v.updatedBy = actor.userId;
        await m.getRepository(FormSchemaVersion).save(v);
      }
      return v;
    });
    return this.withIssues(version);
  }

  async publish(
    schemaId: string,
    versionId: string,
    expectedVersion: number,
    actor: ActorRef,
  ): Promise<FormVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const schema = await this.lockSchema(m, schemaId);
      const v = await this.lockDraft(m, schemaId, versionId);
      assertVersion(v.version, expectedVersion);
      const check = checkDefinition(v.schemaJson, v.uiJson, v.promotions);
      if (check.issues.length) throw definitionInvalid(check.issues);
      // Publish exactly what was checked (normalised options, cleaned promotions).
      v.schemaJson = check.definition!;
      v.promotions = check.promotions;
      return this.publishInTx(m, actor, schema, v);
    });
    return this.withIssues(version);
  }

  /** Stops offering a published version to new orders; pinned orders keep it. */
  async retire(
    schemaId: string,
    versionId: string,
    expectedVersion: number,
    actor: ActorRef,
  ): Promise<FormVersionResponse> {
    const version = await this.dataSource.transaction(async (m) => {
      const schema = await this.lockSchema(m, schemaId);
      const v = await this.findVersion(m, schemaId, versionId, true);
      if (v.status !== DefinitionStatus.PUBLISHED) {
        throw engineError(
          'FORM_VERSION_NOT_PUBLISHED',
          'Only the published version can be retired',
        );
      }
      assertVersion(v.version, expectedVersion);
      await this.setStatus(m, actor, schema, v, DefinitionStatus.RETIRED);
      return v;
    });
    return this.withIssues(version);
  }

  /** Drafts were never used by an order, so they may be thrown away. */
  async discardDraft(
    schemaId: string,
    versionId: string,
    actor: ActorRef,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const schema = await this.lockSchema(m, schemaId);
      const v = await this.lockDraft(m, schemaId, versionId);
      await m.getRepository(FormSchemaVersion).delete({ id: v.id });
      // Logged on the schema: the version row is gone, so its own id would
      // drop out of the form's history.
      await this.audit.record(m, actor, {
        organizationId: schema.organizationId,
        entityType: ENGINE_ENTITY.FORM_SCHEMA,
        entityId: schema.id,
        action: AuditAction.VOID,
        before: { discardedDraft: snapshotOf(v, VERSION_AUDIT_FIELDS) },
      });
    });
  }

  /** Test answers against any version (Studio preview, test runs). */
  async validateData(
    schemaId: string,
    versionId: string,
    data: unknown,
  ): Promise<FormDataResult & { definitionIssues: FormIssue[] }> {
    const v = await this.findVersion(
      this.dataSource.manager,
      schemaId,
      versionId,
    );
    const check = checkDefinition(v.schemaJson, v.uiJson, v.promotions);
    if (!check.definition) {
      return {
        ok: false,
        issues: [],
        value: {},
        definitionIssues: check.issues,
      };
    }
    return {
      ...validateFormData(check.definition, data),
      definitionIssues: check.issues,
    };
  }

  async history(schemaId: string): Promise<TimelineEntry[]> {
    const m = this.dataSource.manager;
    await this.loadSchema(m, schemaId);
    const versionIds = (
      await m.getRepository(FormSchemaVersion).find({
        where: { formSchemaId: schemaId },
        select: { id: true },
      })
    ).map((v) => v.id);
    const entries = (
      await Promise.all([
        this.audit.timeline(m, ENGINE_ENTITY.FORM_SCHEMA, schemaId, null),
        ...versionIds.map((vid) =>
          this.audit.timeline(m, ENGINE_ENTITY.FORM_SCHEMA_VERSION, vid, null),
        ),
      ])
    ).flat();
    return entries.sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    );
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async insertVersion(
    m: EntityManager,
    actor: ActorRef,
    schema: FormSchema,
    versionNo: number,
    content: NewSchemaInput['content'],
  ): Promise<FormSchemaVersion> {
    const repo = m.getRepository(FormSchemaVersion);
    const version = await repo.save(
      repo.create({
        formSchemaId: schema.id,
        versionNo,
        schemaJson: content.schemaJson,
        uiJson: content.uiJson,
        promotions: content.promotions,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      }),
    );
    await this.audit.record(m, actor, {
      organizationId: schema.organizationId,
      entityType: ENGINE_ENTITY.FORM_SCHEMA_VERSION,
      entityId: version.id,
      action: AuditAction.CREATE,
      after: snapshotOf(version, VERSION_AUDIT_FIELDS),
    });
    return version;
  }

  /** Retires the current published version (if any), then publishes `v`. */
  private async publishInTx(
    m: EntityManager,
    actor: ActorRef,
    schema: FormSchema,
    v: FormSchemaVersion,
  ): Promise<FormSchemaVersion> {
    const current = await m.getRepository(FormSchemaVersion).findOne({
      where: { formSchemaId: schema.id, status: DefinitionStatus.PUBLISHED },
      lock: { mode: 'pessimistic_write' },
    });
    if (current) {
      await this.setStatus(m, actor, schema, current, DefinitionStatus.RETIRED);
    }
    v.publishedAt = new Date();
    v.publishedBy = actor.userId;
    await this.setStatus(m, actor, schema, v, DefinitionStatus.PUBLISHED);
    return v;
  }

  private async setStatus(
    m: EntityManager,
    actor: ActorRef,
    schema: FormSchema,
    v: FormSchemaVersion,
    status: DefinitionStatus,
  ): Promise<void> {
    const before = { status: v.status };
    v.status = status;
    if (status === DefinitionStatus.RETIRED) v.retiredAt = new Date();
    v.updatedBy = actor.userId;
    await m.getRepository(FormSchemaVersion).save(v);
    await this.audit.record(m, actor, {
      organizationId: schema.organizationId,
      entityType: ENGINE_ENTITY.FORM_SCHEMA_VERSION,
      entityId: v.id,
      action: AuditAction.UPDATE,
      before,
      after: { status },
    });
  }

  private withIssues(v: FormSchemaVersion): FormVersionResponse {
    const issues =
      v.status === DefinitionStatus.DRAFT
        ? checkDefinition(v.schemaJson, v.uiJson, v.promotions).issues
        : [];
    return toVersionResponse(v, issues);
  }

  private async summaries(
    m: EntityManager,
    schemas: FormSchema[],
  ): Promise<FormSchemaSummary[]> {
    if (!schemas.length) return [];
    const live = await m
      .getRepository(FormSchemaVersion)
      .createQueryBuilder('v')
      .where('v.form_schema_id IN (:...ids)', { ids: schemas.map((s) => s.id) })
      .andWhere('v.status IN (:...statuses)', {
        statuses: [DefinitionStatus.PUBLISHED, DefinitionStatus.DRAFT],
      })
      .getMany();
    return schemas.map((s) => {
      const current = live.find(
        (v) =>
          v.formSchemaId === s.id && v.status === DefinitionStatus.PUBLISHED,
      );
      const draft = live.find(
        (v) => v.formSchemaId === s.id && v.status === DefinitionStatus.DRAFT,
      );
      return {
        id: s.id,
        specialty: {
          id: s.specialty.id,
          code: s.specialty.code,
          name: s.specialty.name,
        },
        organization: s.organization
          ? { id: s.organization.id, name: s.organization.name }
          : null,
        code: s.code,
        name: s.name,
        description: s.description,
        isActive: s.isActive,
        current: current
          ? {
              id: current.id,
              versionNo: current.versionNo,
              publishedAt: current.publishedAt!,
            }
          : null,
        draft: draft ? { id: draft.id, versionNo: draft.versionNo } : null,
        version: s.version,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });
  }

  private async loadSchema(m: EntityManager, id: string): Promise<FormSchema> {
    const schema = await m.getRepository(FormSchema).findOne({
      where: { id },
      relations: { specialty: true, organization: true },
    });
    if (!schema) throw engineError('FORM_SCHEMA_NOT_FOUND', 'Form not found');
    return schema;
  }

  /** Row-locks the schema: serialises version numbering and publishing. */
  private async lockSchema(m: EntityManager, id: string): Promise<FormSchema> {
    const schema = await m.getRepository(FormSchema).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!schema) throw engineError('FORM_SCHEMA_NOT_FOUND', 'Form not found');
    return schema;
  }

  private async findVersion(
    m: EntityManager,
    schemaId: string,
    versionId: string,
    lock = false,
  ): Promise<FormSchemaVersion> {
    const v = await m.getRepository(FormSchemaVersion).findOne({
      where: { id: versionId, formSchemaId: schemaId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!v) throw engineError('FORM_VERSION_NOT_FOUND', 'Version not found');
    return v;
  }

  private async lockDraft(
    m: EntityManager,
    schemaId: string,
    versionId: string,
  ): Promise<FormSchemaVersion> {
    const v = await this.findVersion(m, schemaId, versionId, true);
    if (v.status !== DefinitionStatus.DRAFT) {
      throw engineError(
        'FORM_VERSION_NOT_DRAFT',
        'Published versions never change — create a new draft instead',
      );
    }
    return v;
  }
}
