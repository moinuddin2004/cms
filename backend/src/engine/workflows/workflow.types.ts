import { ALL_APP_ROLES } from 'src/common/enums/app-role.enum';
import { LabMemberRole } from 'src/labs/enums/lab.enums';

/**
 * Workflow definition — what a workflow template version holds (lab ERD
 * §3, §9, §17). Drafts keep it as JSON while they are edited; publishing
 * materialises it into `workflow_states` / `workflow_transitions` /
 * `transition_effects`, which the runtime reads.
 */

export const WORKFLOW_ENTITY_TYPES = ['order', 'item', 'stage'] as const;
export type WorkflowEntityType = (typeof WORKFLOW_ENTITY_TYPES)[number];

export const STATE_CATEGORIES = [
  'initial',
  'active',
  'waiting',
  'done',
  'cancelled',
] as const;
export type StateCategory = (typeof STATE_CATEGORIES)[number];

/** done / cancelled states end the lifecycle. */
export const TERMINAL_CATEGORIES: readonly StateCategory[] = [
  'done',
  'cancelled',
];

export const TRANSITION_SIDES = ['clinic', 'lab', 'system'] as const;
export type TransitionSide = (typeof TRANSITION_SIDES)[number];

/** Roles a transition may name — every role that exists in the system. */
export const KNOWN_ROLES: readonly string[] = [
  ...ALL_APP_ROLES,
  ...Object.values(LabMemberRole),
];

/**
 * Status changes the engine computes itself (order status from its items).
 * Many may leave one state, so they are exempt from the one-action-per-state
 * rule, and they never come from a user.
 */
export const DERIVED_ACTION = 'derive';

export interface StateDef {
  code: string;
  name: string;
  category: StateCategory;
}

export interface EffectRef {
  code: string;
  params?: Record<string, unknown>;
}

export interface TransitionDef {
  from: string;
  to: string;
  action: string;
  /** Empty = any role of an allowed side. */
  allowedRoles?: string[];
  allowedSides: TransitionSide[];
  /** Keys the caller must send in the transition input (e.g. lab_expected_on). */
  requiredFields?: string[];
  requiresReason?: boolean;
  /** Run in order inside the transition's transaction. */
  effects?: EffectRef[];
}

export interface WorkflowDefinition {
  states: StateDef[];
  transitions: TransitionDef[];
}

export interface DefinitionIssue {
  path: string;
  code: string;
  message: string;
}
