import type { EntityManager } from 'typeorm';
import type { TransitionVia } from 'src/common/audit/audit.enums';
import type { TransitionSide } from '../workflows/workflow.types';

/** Who asks for a transition. */
export interface TransitionActor {
  /** Null for system jobs. */
  userId: string | null;
  side: TransitionSide;
  /** Clinic roles at the active location, or lab member roles. */
  roles: string[];
  via?: TransitionVia;
  ip?: string | null;
  requestId?: string | null;
}

/** A row driven by a workflow (order, item, stage …), already row-locked. */
export interface WorkflowSubject {
  id: string;
  organizationId: string;
  /** The pinned, published workflow version. */
  workflowVersionId: string;
  state: string;
  version: number;
  /** The lab doing the work — needed for proxy updates. */
  labId?: string | null;
}

export interface AdapterContext {
  m: EntityManager;
  actor: TransitionActor;
}

/**
 * How the engine reads and writes one kind of subject. Each module that
 * owns workflow-driven rows (orders, items, stages) registers one; the
 * engine itself never knows table names.
 */
export interface SubjectAdapter {
  entityType: string;
  /** Load + `SELECT … FOR UPDATE`, scoped to the organization. Null = not found. */
  lock(
    m: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<WorkflowSubject | null>;
  /** Persist the new state and bump the row version; returns the new version. */
  setState(
    m: EntityManager,
    subject: WorkflowSubject,
    toState: string,
  ): Promise<number>;
  /** After the change, e.g. an item re-derives its order's status. */
  afterTransition?(
    subject: WorkflowSubject,
    ctx: AdapterContext,
  ): Promise<void>;
  /** Used by the `recompute_order_status` effect. */
  recompute?(subject: WorkflowSubject, ctx: AdapterContext): Promise<void>;
}

export interface TransitionRequest {
  organizationId: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: TransitionActor;
  input?: Record<string, unknown>;
  reason?: string | null;
  /** Optimistic lock (If-Match). */
  expectedVersion?: number;
  /** Same key + same request → the first result, no second change. */
  idempotencyKey?: string;
  /** Proxy updates: the lab the clinic acts for. */
  onBehalfOfLabId?: string | null;
}

export interface TransitionResult {
  entityType: string;
  entityId: string;
  action: string;
  fromState: string;
  toState: string;
  version: number;
  replayed: boolean;
}
