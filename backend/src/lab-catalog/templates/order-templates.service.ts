import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In } from 'typeorm';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AuditService } from 'src/common/audit/audit.service';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { Specialty } from 'src/engine/entities/specialty.entity';
import type { FormIssue } from 'src/engine/forms/form-definition.types';
import { FormResolverService } from 'src/engine/forms/form-resolver.service';
import type { ClinicActor } from 'src/labs/common/clinic-actor';
import { likePattern } from 'src/labs/common/lab-query';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { LabLinkStatus } from 'src/labs/enums/lab.enums';
import { User } from 'src/user/entities/user.entity';
import { catalogError } from '../common/catalog-errors';
import {
  CreateTemplateDto,
  ListTemplatesQueryDto,
  TemplateItemDto,
  UpdateTemplateDto,
} from '../dto/catalog.dto';
import { LabServiceOption } from '../entities/lab-service-option.entity';
import { LabService } from '../entities/lab-service.entity';
import { OrderTemplate } from '../entities/order-template.entity';
import { CATALOG_ENTITY } from '../enums/catalog.enums';
import {
  OrderTemplateResponse,
  TEMPLATE_AUDIT_FIELDS,
} from '../mappers/catalog-response';
import {
  OrderTemplateBody,
  OrderTemplateItem,
  validateTemplateAnswers,
} from './order-template.types';

/** Shared (clinic-wide) templates are created and edited with this permission. */
const canShare = (actor: ClinicActor) =>
  actor.access.can('lab.templates.share');

/**
 * Saved orders (lab ERD §13 "Doctor speed"). Tenant-scoped. A template is
 * the caller's own or shared with the clinic; nobody sees another user's
 * own templates. Shared ones are created and edited with
 * `lab.templates.share`.
 */
@Injectable()
export class OrderTemplatesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly forms: FormResolverService,
  ) {}

  async list(
    organizationId: string,
    actor: ClinicActor,
    q: ListTemplatesQueryDto,
  ): Promise<PaginatedResponseDto<OrderTemplateResponse>> {
    const scope = q.scope ?? 'all';
    const qb = this.dataSource
      .getRepository(OrderTemplate)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.lab', 'lab')
      .where('t.organization_id = :organizationId', { organizationId })
      .orderBy('t.useCount', 'DESC')
      .addOrderBy('t.name', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (scope === 'mine') {
      qb.andWhere('t.owner_user_id = :me', { me: actor.userId });
    } else if (scope === 'shared') {
      qb.andWhere('t.owner_user_id IS NULL');
    } else {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('t.owner_user_id IS NULL')
            .orWhere('t.owner_user_id = :me', { me: actor.userId }),
        ),
      );
    }
    if (!q.includeInactive) qb.andWhere('t.is_active');
    if (q.labId) qb.andWhere('t.lab_id = :labId', { labId: q.labId });
    if (q.search) {
      qb.andWhere('t.name ILIKE :term', { term: likePattern(q.search) });
    }
    const [rows, total] = await qb.getManyAndCount();
    const owners = await this.ownerNames(rows);
    return PaginatedResponseDto.create(
      rows.map((t) => this.toResponse(t, actor, owners)),
      total,
      q.page,
      q.limit,
    );
  }

  async get(
    organizationId: string,
    actor: ClinicActor,
    id: string,
  ): Promise<OrderTemplateResponse> {
    const t = await this.visible(
      this.dataSource.manager,
      organizationId,
      actor,
      id,
    );
    return this.toResponse(t, actor, await this.ownerNames([t]));
  }

  async create(
    organizationId: string,
    actor: ClinicActor,
    ref: ActorRef,
    dto: CreateTemplateDto,
  ): Promise<OrderTemplateResponse> {
    if (dto.shared && !canShare(actor)) {
      throw catalogError(
        'ORDER_TEMPLATE_FORBIDDEN',
        'You do not have permission to share templates with the whole clinic',
      );
    }
    return this.dataSource.transaction(async (m) => {
      const built = await this.buildBody(
        m,
        organizationId,
        dto.items,
        dto.notes ?? null,
      );
      const repo = m.getRepository(OrderTemplate);
      const t = await repo.save(
        repo.create({
          organizationId,
          ownerUserId: dto.shared ? null : actor.userId,
          specialtyId: built.specialtyId,
          labId: built.labId,
          name: dto.name,
          templateJson: built.body,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        }),
      );
      await this.audit.record(m, ref, {
        organizationId,
        entityType: CATALOG_ENTITY.ORDER_TEMPLATE,
        entityId: t.id,
        action: AuditAction.CREATE,
        after: snapshotOf(t, TEMPLATE_AUDIT_FIELDS),
      });
      const saved = await repo.findOneOrFail({
        where: { id: t.id },
        relations: { lab: true },
      });
      return this.toResponse(saved, actor, await this.ownerNames([saved], m));
    });
  }

  async update(
    organizationId: string,
    actor: ClinicActor,
    ref: ActorRef,
    id: string,
    dto: UpdateTemplateDto,
  ): Promise<OrderTemplateResponse> {
    return this.dataSource.transaction(async (m) => {
      await this.visible(m, organizationId, actor, id);
      const t = await m.getRepository(OrderTemplate).findOneOrFail({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      assertVersion(t.version, dto.version);
      if (!this.canEdit(t, actor) || (dto.shared && !canShare(actor))) {
        throw catalogError(
          'ORDER_TEMPLATE_FORBIDDEN',
          'You do not have permission to change shared templates',
        );
      }
      const before = snapshotOf(t, TEMPLATE_AUDIT_FIELDS);
      if (dto.name !== undefined) t.name = dto.name;
      if (dto.shared !== undefined) {
        t.ownerUserId = dto.shared ? null : (t.ownerUserId ?? actor.userId);
      }
      if (dto.items !== undefined || dto.notes !== undefined) {
        const built = await this.buildBody(
          m,
          organizationId,
          dto.items ?? t.templateJson.items.map(toItemDto),
          dto.notes === undefined ? t.templateJson.notes : dto.notes,
        );
        t.templateJson = built.body;
        t.labId = built.labId;
        t.specialtyId = built.specialtyId;
      }
      if (dto.isActive !== undefined) t.isActive = dto.isActive;
      const changed = await this.audit.record(m, ref, {
        organizationId,
        entityType: CATALOG_ENTITY.ORDER_TEMPLATE,
        entityId: t.id,
        action: AuditAction.UPDATE,
        before,
        after: snapshotOf(t, TEMPLATE_AUDIT_FIELDS),
      });
      if (changed) {
        t.updatedBy = actor.userId;
        await m.getRepository(OrderTemplate).save(t);
      }
      const saved = await m.getRepository(OrderTemplate).findOneOrFail({
        where: { id },
        relations: { lab: true },
      });
      return this.toResponse(saved, actor, await this.ownerNames([saved], m));
    });
  }

  /**
   * Counts a use (doctor started an order from it). Sprint 6 calls this in
   * the order-submit transaction; not audited — usage, not a change.
   */
  async markUsed(
    m: EntityManager,
    organizationId: string,
    actor: ClinicActor,
    id: string,
  ): Promise<void> {
    await this.visible(m, organizationId, actor, id);
    // Raw on purpose: a use is not an edit, so no version / updated_at bump.
    await m.query(
      `UPDATE order_templates SET use_count = use_count + 1, last_used_at = now()
        WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
    );
  }

  async use(
    organizationId: string,
    actor: ClinicActor,
    id: string,
  ): Promise<OrderTemplateResponse> {
    await this.dataSource.transaction((m) =>
      this.markUsed(m, organizationId, actor, id),
    );
    return this.get(organizationId, actor, id);
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /**
   * Validates the lines and builds the stored body. All services must be
   * active, of one lab on the clinic's list and of one specialty; options
   * must belong to their service; answers must fit the service's form
   * (partial — required answers may be left for the order).
   */
  private async buildBody(
    m: EntityManager,
    organizationId: string,
    items: TemplateItemDto[],
    notes: string | null,
  ): Promise<{ body: OrderTemplateBody; labId: string; specialtyId: string }> {
    const issues: FormIssue[] = [];
    const ids = [...new Set(items.map((i) => i.labServiceId))];
    const services = await m.getRepository(LabService).find({
      where: { id: In(ids) },
      relations: { formSchema: true },
    });
    const byId = new Map(services.map((s) => [s.id, s]));
    const labIds = new Set(services.map((s) => s.labId));
    const linkedLabs = labIds.size
      ? await m.getRepository(LabClinicLink).find({
          where: {
            organizationId,
            labId: In([...labIds]),
            status: In([LabLinkStatus.ACTIVE, LabLinkStatus.INVITED]),
          },
        })
      : [];
    const linked = new Set(linkedLabs.map((k) => k.labId));

    for (const [i, item] of items.entries()) {
      const s = byId.get(item.labServiceId);
      if (!s || !linked.has(s.labId)) {
        issues.push(issue(i, 'labServiceId', 'not_found', 'Service not found'));
      } else if (!s.isActive) {
        issues.push(
          issue(
            i,
            'labServiceId',
            'inactive',
            `${s.name} is no longer offered`,
          ),
        );
      }
    }
    if (issues.length) throw invalid(issues);
    if (labIds.size > 1) {
      throw invalid([
        issue(
          0,
          'labServiceId',
          'mixed_labs',
          'All services must be from one lab',
        ),
      ]);
    }
    const specialtyIds = new Set(services.map((s) => s.specialtyId));
    if (specialtyIds.size > 1) {
      throw invalid([
        issue(
          0,
          'labServiceId',
          'mixed_specialties',
          'All services must be of one specialty',
        ),
      ]);
    }
    const specialtyId = services[0].specialtyId;
    const specialty = await m
      .getRepository(Specialty)
      .findOneByOrFail({ id: specialtyId });

    const optionIds = items.flatMap((i) => i.optionIds ?? []);
    const options = optionIds.length
      ? await m.getRepository(LabServiceOption).findBy({
          id: In(optionIds),
          isActive: true,
        })
      : [];
    const needsForms = services.some((s) => s.formSchema);
    const current = needsForms
      ? await this.forms.current(organizationId, specialty.code, m)
      : [];

    const out: OrderTemplateItem[] = [];
    for (const [i, item] of items.entries()) {
      const s = byId.get(item.labServiceId)!;
      for (const optionId of item.optionIds ?? []) {
        const ok = options.some(
          (o) => o.id === optionId && o.labServiceId === s.id,
        );
        if (!ok) {
          issues.push(
            issue(
              i,
              'optionIds',
              'not_found',
              'Option not offered for this service',
            ),
          );
        }
      }
      let answers: Record<string, unknown> = {};
      const form: FormSchema | null = s.formSchema;
      if (form) {
        const version = current.find((f) => f.code === form.code);
        if (!version) {
          issues.push(
            issue(
              i,
              'answers',
              'form_unavailable',
              `The ${form.name} form is not available`,
            ),
          );
        } else {
          const checked = validateTemplateAnswers(
            version.schemaJson,
            item.answers ?? {},
          );
          for (const x of checked.issues) {
            issues.push(issue(i, `answers.${x.path}`, x.code, x.message));
          }
          answers = checked.value;
        }
      } else if (item.answers && Object.keys(item.answers).length) {
        issues.push(
          issue(
            i,
            'answers',
            'no_form',
            'This service has no form to pre-fill',
          ),
        );
      }
      out.push({
        labServiceId: s.id,
        optionIds: item.optionIds ?? [],
        quantity: item.quantity ?? 1,
        rush: item.rush ?? false,
        formCode: form?.code ?? null,
        answers,
      });
    }
    if (issues.length) throw invalid(issues);
    return {
      body: { schemaVersion: 1, items: out, notes },
      labId: services[0].labId,
      specialtyId,
    };
  }

  private canEdit(t: OrderTemplate, actor: ClinicActor): boolean {
    return t.ownerUserId === null
      ? canShare(actor)
      : t.ownerUserId === actor.userId;
  }

  /** Shared or the caller's own; anything else answers 404. */
  private async visible(
    m: EntityManager,
    organizationId: string,
    actor: ClinicActor,
    id: string,
  ): Promise<OrderTemplate> {
    const t = await m.getRepository(OrderTemplate).findOne({
      where: { id, organizationId },
      relations: { lab: true },
    });
    if (!t || (t.ownerUserId !== null && t.ownerUserId !== actor.userId)) {
      throw catalogError('ORDER_TEMPLATE_NOT_FOUND', 'Template not found');
    }
    return t;
  }

  private async ownerNames(
    rows: OrderTemplate[],
    m: EntityManager = this.dataSource.manager,
  ): Promise<Map<string, string | null>> {
    const ids = [
      ...new Set(
        rows.map((r) => r.ownerUserId).filter((x): x is string => !!x),
      ),
    ];
    const out = new Map<string, string | null>();
    if (!ids.length) return out;
    const users = await m
      .getRepository(User)
      .find({ where: { uuid: In(ids) }, select: ['uuid', 'name', 'email'] });
    for (const u of users) out.set(u.uuid, u.name ?? u.email);
    return out;
  }

  private toResponse(
    t: OrderTemplate,
    actor: ClinicActor,
    owners: Map<string, string | null>,
  ): OrderTemplateResponse {
    return {
      id: t.id,
      name: t.name,
      shared: t.ownerUserId === null,
      owner: t.ownerUserId
        ? { id: t.ownerUserId, name: owners.get(t.ownerUserId) ?? null }
        : null,
      specialtyId: t.specialtyId,
      lab: t.lab ? { id: t.lab.id, name: t.lab.name } : null,
      body: t.templateJson,
      useCount: t.useCount,
      lastUsedAt: t.lastUsedAt,
      isActive: t.isActive,
      canEdit: this.canEdit(t, actor),
      version: t.version,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}

function issue(
  i: number,
  field: string,
  code: string,
  message: string,
): FormIssue {
  return { path: `items[${i}].${field}`, code, message };
}

function invalid(issues: FormIssue[]) {
  return catalogError(
    'ORDER_TEMPLATE_INVALID',
    issues[0]?.message ?? 'The template is not valid',
    { issues },
  );
}

const toItemDto = (i: OrderTemplateItem): TemplateItemDto => ({
  labServiceId: i.labServiceId,
  optionIds: i.optionIds,
  quantity: i.quantity,
  rush: i.rush,
  answers: i.answers,
});
