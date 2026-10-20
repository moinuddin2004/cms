import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  ActorRef,
  ActorSide,
  AuditAction,
  TransitionVia,
} from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import {
  IdempotencyService,
  requestHash,
} from 'src/common/idempotency/idempotency.service';
import { AppRole } from 'src/common/enums/app-role.enum';
import { engineError } from '../common/engine-errors';
import { TransitionEffect } from '../entities/workflow-effect.entity';
import { WorkflowState } from '../entities/workflow-state.entity';
import { WorkflowTemplateVersion } from '../entities/workflow-template-version.entity';
import { WorkflowTransition } from '../entities/workflow-transition.entity';
import { DefinitionStatus } from '../enums/engine.enums';
import { DERIVED_ACTION } from '../workflows/workflow.types';
import type { CompiledTransition, CompiledWorkflow } from './compiled-workflow';
import { EffectRegistry } from './effect-registry';
import type {
  SubjectAdapter,
  TransitionActor,
  TransitionRequest,
  TransitionResult,
  WorkflowSubject,
} from './runtime.types';

const IDEMPOTENCY_SCOPE = 'workflow.transition';
const SYSTEM_ACTOR: TransitionActor = {
  userId: null,
  side: 'system',
  roles: [],
};

const isBlank = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && !v.trim()) ||
  (Array.isArray(v) && !v.length);

/**
 * The workflow "referee" (lab ERD §17). Every status change of a
 * workflow-driven row goes through `transition()` — never a direct UPDATE:
 *
 * idempotency → lock subject → find (state, action) in its pinned version
 * → side/role check → required input + reason → write state → status
 * history → effects in order → afterTransition (e.g. derive the order) →
 * audit. One transaction: anything fails, nothing happened.
 */
@Injectable()
export class WorkflowEngine {
  private readonly adapters = new Map<string, SubjectAdapter>();
  private readonly cache = new Map<string, CompiledWorkflow>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly effects: EffectRegistry,
    private readonly idempotency: IdempotencyService,
  ) {}

  registerAdapter(adapter: SubjectAdapter): void {
    if (this.adapters.has(adapter.entityType)) {
      throw new Error(
        `Workflow adapter for ${adapter.entityType} registered twice`,
      );
    }
    this.adapters.set(adapter.entityType, adapter);
  }

  async transition(req: TransitionRequest): Promise<TransitionResult> {
    return this.dataSource.transaction((m) => this.transitionIn(m, req));
  }

  /**
   * `transition()` inside the caller's transaction — for operations that
   * change a status as one step of a larger write (order submit, lab ERD
   * §10): the status change commits or rolls back with the rest.
   */
  async transitionIn(
    m: EntityManager,
    req: TransitionRequest,
  ): Promise<TransitionResult> {
    const adapter = this.adapter(req.entityType);
    const hash = req.idempotencyKey
      ? requestHash({
          entityType: req.entityType,
          entityId: req.entityId,
          action: req.action,
          input: req.input ?? {},
          reason: req.reason ?? null,
        })
      : null;
    if (req.idempotencyKey && hash) {
      const replay = await this.idempotency.claim(
        m,
        req.organizationId,
        IDEMPOTENCY_SCOPE,
        req.idempotencyKey,
        hash,
      );
      if (replay)
        return { ...(replay.response as TransitionResult), replayed: true };
    }

    const subject = await adapter.lock(m, req.organizationId, req.entityId);
    if (!subject) {
      throw engineError(
        'WORKFLOW_SUBJECT_NOT_FOUND',
        `${req.entityType} not found`,
      );
    }
    if (req.expectedVersion !== undefined) {
      assertVersion(subject.version, req.expectedVersion);
    }

    const workflow = await this.compiled(m, subject.workflowVersionId);
    const transition = this.findTransition(workflow, subject.state, req.action);
    const effectiveSide = this.authorize(req, transition, subject);
    this.checkInput(req, transition);

    const result = await this.apply(
      m,
      adapter,
      subject,
      transition,
      req,
      effectiveSide,
    );
    if (req.idempotencyKey) {
      await this.idempotency.complete(
        m,
        req.organizationId,
        IDEMPOTENCY_SCOPE,
        req.idempotencyKey,
        result,
      );
    }
    return result;
  }

  /**
   * Sets a status the engine computed (order status from its items, lab
   * ERD §9c), in the caller's transaction. `subject` must be locked. No-op
   * when unchanged. Derived changes are not user actions, so they are not
   * looked up as transitions — the target only has to be a state of the
   * subject's version.
   */
  async applyDerived(
    m: EntityManager,
    entityType: string,
    subject: WorkflowSubject,
    toState: string,
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (subject.state === toState) return false;
    const adapter = this.adapter(entityType);
    const workflow = await this.compiled(m, subject.workflowVersionId);
    if (!workflow.states.has(toState)) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        `Derived state "${toState}" is not in the ${entityType} workflow`,
      );
    }
    const from = subject.state;
    subject.version = await adapter.setState(m, subject, toState);
    subject.state = toState;
    const actor = this.auditActor(SYSTEM_ACTOR);
    await this.audit.recordStatus(m, actor, {
      organizationId: subject.organizationId,
      entityType,
      entityId: subject.id,
      fromState: from,
      toState,
      actionCode: DERIVED_ACTION,
      metadata,
    });
    await this.audit.record(m, actor, {
      organizationId: subject.organizationId,
      entityType,
      entityId: subject.id,
      action: AuditAction.UPDATE,
      before: { status: from },
      after: { status: toState },
    });
    return true;
  }

  /** Actions the actor could take from `state` (for buttons in the UI). */
  async availableActions(
    versionId: string,
    state: string,
    actor: TransitionActor,
  ): Promise<string[]> {
    const workflow = await this.compiled(this.dataSource.manager, versionId);
    return workflow.transitions
      .filter(
        (t) =>
          t.from === state &&
          t.action !== DERIVED_ACTION &&
          t.allowedSides.includes(actor.side) &&
          (actor.side === 'system' ||
            !t.allowedRoles.length ||
            t.allowedRoles.some((r) => actor.roles.includes(r))),
      )
      .map((t) => t.action);
  }

  /** A published (or retired) version, read once — they never change. */
  async compiled(
    m: EntityManager,
    versionId: string,
  ): Promise<CompiledWorkflow> {
    const cached = this.cache.get(versionId);
    if (cached) return cached;

    const version = await m.getRepository(WorkflowTemplateVersion).findOne({
      where: { id: versionId },
      relations: { workflowTemplate: true },
    });
    if (!version || version.status === DefinitionStatus.DRAFT) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        'The subject is pinned to a workflow version that is not published',
      );
    }
    const [states, transitions] = await Promise.all([
      m.getRepository(WorkflowState).find({
        where: { templateVersionId: versionId },
        order: { sortOrder: 'ASC' },
      }),
      m.getRepository(WorkflowTransition).find({
        where: { templateVersionId: versionId },
      }),
    ]);
    const effects = transitions.length
      ? await m.getRepository(TransitionEffect).find({
          where: { transitionId: In(transitions.map((t) => t.id)) },
          order: { seq: 'ASC' },
        })
      : [];
    const codeById = new Map(states.map((s) => [s.id, s.code]));

    const compiled: CompiledWorkflow = {
      versionId,
      entityType: version.workflowTemplate.entityType,
      states: new Map(
        states.map((s) => [
          s.code,
          {
            id: s.id,
            code: s.code,
            name: s.name,
            category: s.category,
            isTerminal: s.isTerminal,
          },
        ]),
      ),
      transitions: transitions.map((t) => ({
        id: t.id,
        from: codeById.get(t.fromStateId)!,
        to: codeById.get(t.toStateId)!,
        action: t.actionCode,
        allowedRoles: t.allowedRoles,
        allowedSides: t.allowedSides,
        requiredFields: t.requiredFields,
        requiresReason: t.requiresReason,
        effects: effects
          .filter((e) => e.transitionId === t.id)
          .map((e) => ({ code: e.effectCode, params: e.params ?? {} })),
      })),
    };
    this.cache.set(versionId, compiled);
    return compiled;
  }

  // ── steps ──────────────────────────────────────────────────────────────

  private findTransition(
    workflow: CompiledWorkflow,
    state: string,
    action: string,
  ): CompiledTransition {
    const transition =
      action === DERIVED_ACTION
        ? undefined
        : workflow.transitions.find(
            (t) => t.from === state && t.action === action,
          );
    if (!transition) {
      throw engineError(
        'INVALID_TRANSITION',
        `Cannot ${action} from ${state}`,
        {
          from: state,
          action,
          allowedActions: workflow.transitions
            .filter((t) => t.from === state && t.action !== DERIVED_ACTION)
            .map((t) => t.action),
        },
      );
    }
    return transition;
  }

  /**
   * Side + role check. A proxy update (clinic admin acting for a lab that
   * isn't answering, lab ERD §7) is checked as the lab side, without lab
   * roles, and recorded with `via = proxy` and the lab's id.
   */
  private authorize(
    req: TransitionRequest,
    t: CompiledTransition,
    subject: WorkflowSubject,
  ): string {
    const { actor } = req;
    let side: string = actor.side;
    let checkRoles = actor.side !== 'system';

    if (actor.via === TransitionVia.PROXY) {
      const labId = req.onBehalfOfLabId ?? null;
      if (
        actor.side !== 'clinic' ||
        !actor.roles.includes(AppRole.CLINIC_ADMIN) ||
        !labId ||
        (subject.labId !== undefined && subject.labId !== labId)
      ) {
        throw engineError(
          'TRANSITION_FORBIDDEN',
          'Only a clinic admin can update on behalf of this case’s lab',
        );
      }
      side = 'lab';
      checkRoles = false;
    }

    if (!t.allowedSides.includes(side)) {
      throw engineError(
        'TRANSITION_FORBIDDEN',
        `The ${side} side cannot ${t.action} here`,
      );
    }
    if (
      checkRoles &&
      t.allowedRoles.length &&
      !t.allowedRoles.some((r) => actor.roles.includes(r))
    ) {
      throw engineError(
        'TRANSITION_FORBIDDEN',
        `${t.action} needs one of these roles: ${t.allowedRoles.join(', ')}`,
      );
    }
    return side;
  }

  private checkInput(req: TransitionRequest, t: CompiledTransition): void {
    const input = req.input ?? {};
    const missing = t.requiredFields.filter((f) => isBlank(input[f]));
    if (missing.length) {
      throw engineError(
        'TRANSITION_INPUT_REQUIRED',
        `${t.action} needs: ${missing.join(', ')}`,
        { missing },
      );
    }
    if (t.requiresReason && isBlank(req.reason)) {
      throw engineError(
        'TRANSITION_REASON_REQUIRED',
        `A reason is required to ${t.action}`,
      );
    }
  }

  private async apply(
    m: EntityManager,
    adapter: SubjectAdapter,
    subject: WorkflowSubject,
    t: CompiledTransition,
    req: TransitionRequest,
    effectiveSide: string,
  ): Promise<TransitionResult> {
    const from = subject.state;
    subject.version = await adapter.setState(m, subject, t.to);
    subject.state = t.to;

    const actor = this.auditActor(req.actor);
    const proxy = req.actor.via === TransitionVia.PROXY;
    await this.audit.recordStatus(m, actor, {
      organizationId: subject.organizationId,
      entityType: req.entityType,
      entityId: subject.id,
      fromState: from,
      toState: t.to,
      actionCode: t.action,
      via: req.actor.via ?? TransitionVia.APP,
      onBehalfOfLabId: proxy ? req.onBehalfOfLabId : null,
      reason: req.reason?.trim() || null,
      metadata:
        req.input && Object.keys(req.input).length
          ? { input: req.input }
          : null,
    });

    const ctx = { m, actor: req.actor };
    for (const effect of t.effects) {
      const handler = this.effects.get(effect.code);
      if (!handler) {
        throw engineError(
          'WORKFLOW_MISCONFIGURED',
          `Effect ${effect.code} has no handler in this build`,
        );
      }
      await handler.run({
        ...ctx,
        subject,
        adapter,
        transition: t,
        request: req,
        params: effect.params,
      });
    }
    if (adapter.afterTransition) await adapter.afterTransition(subject, ctx);

    await this.audit.record(m, actor, {
      organizationId: subject.organizationId,
      entityType: req.entityType,
      entityId: subject.id,
      action: AuditAction.UPDATE,
      before: { status: from },
      after: { status: t.to, ...(proxy ? { actingAs: effectiveSide } : {}) },
    });

    return {
      entityType: req.entityType,
      entityId: subject.id,
      action: t.action,
      fromState: from,
      toState: t.to,
      version: subject.version,
      replayed: false,
    };
  }

  private adapter(entityType: string): SubjectAdapter {
    const adapter = this.adapters.get(entityType);
    if (!adapter) {
      throw engineError(
        'WORKFLOW_MISCONFIGURED',
        `No workflow adapter for ${entityType}`,
      );
    }
    return adapter;
  }

  private auditActor(actor: TransitionActor): ActorRef {
    return {
      userId: actor.userId,
      side: actor.side as ActorSide,
      ip: actor.ip ?? null,
      requestId: actor.requestId ?? null,
    };
  }
}
