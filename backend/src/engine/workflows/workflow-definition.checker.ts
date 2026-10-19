import {
  DERIVED_ACTION,
  DefinitionIssue,
  KNOWN_ROLES,
  STATE_CATEGORIES,
  StateCategory,
  StateDef,
  TERMINAL_CATEGORIES,
  TRANSITION_SIDES,
  TransitionDef,
  TransitionSide,
  WorkflowDefinition,
} from './workflow.types';

const CODE = /^[a-z][a-z0-9_]{0,49}$/;
const MAX_STATES = 60;
const MAX_TRANSITIONS = 300;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(isStr);

export interface WorkflowCheck {
  issues: DefinitionIssue[];
  /** Normalised definition when structurally readable. */
  definition: WorkflowDefinition | null;
}

export const isTerminal = (category: StateCategory): boolean =>
  TERMINAL_CATEGORIES.includes(category);

/**
 * Publish validations for a workflow (lab ERD §18): exactly one initial
 * state; at least one done and one cancelled terminal state; every state
 * reachable from the initial one; a way forward from every non-terminal
 * state; nothing leaves a terminal state; only registered effects and real
 * roles; one target per (state, action) except derived changes.
 */
export function checkWorkflow(
  raw: unknown,
  knownEffects: ReadonlySet<string>,
): WorkflowCheck {
  const issues: DefinitionIssue[] = [];
  const issue = (path: string, code: string, message: string) =>
    issues.push({ path, code, message });

  if (
    !isObj(raw) ||
    !Array.isArray(raw.states) ||
    !Array.isArray(raw.transitions)
  ) {
    issue(
      '',
      'invalid_definition',
      'A workflow needs "states" and "transitions" lists',
    );
    return { issues, definition: null };
  }
  if (raw.states.length > MAX_STATES)
    issue('states', 'too_many', `At most ${MAX_STATES} states`);
  if (raw.transitions.length > MAX_TRANSITIONS) {
    issue('transitions', 'too_many', `At most ${MAX_TRANSITIONS} transitions`);
  }

  // ── states ──
  const states = new Map<string, StateDef>();
  raw.states.forEach((s, i) => {
    const at = `states[${i}]`;
    if (!isObj(s) || !isStr(s.code) || !CODE.test(s.code)) {
      issue(
        at,
        'invalid_state',
        'State codes are lowercase letters, digits and _',
      );
      return;
    }
    if (states.has(s.code)) {
      issue(at, 'duplicate_state', `State "${s.code}" is defined twice`);
      return;
    }
    if (!isStr(s.name) || !s.name.trim() || s.name.length > 100) {
      issue(at, 'invalid_name', `State "${s.code}" needs a name (max 100)`);
    }
    if (!STATE_CATEGORIES.includes(s.category as StateCategory)) {
      issue(
        at,
        'invalid_category',
        `Category is one of ${STATE_CATEGORIES.join(', ')}`,
      );
      return;
    }
    states.set(s.code, {
      code: s.code,
      name: isStr(s.name) ? s.name.trim() : s.code,
      category: s.category as StateCategory,
    });
  });

  const byCategory = (c: StateCategory) =>
    [...states.values()].filter((s) => s.category === c);
  const initial = byCategory('initial');
  if (initial.length !== 1) {
    issue(
      'states',
      'initial_state',
      `Exactly one initial state (found ${initial.length})`,
    );
  }
  if (!byCategory('done').length) {
    issue('states', 'no_done_state', 'At least one "done" terminal state');
  }
  if (!byCategory('cancelled').length) {
    issue(
      'states',
      'no_cancelled_state',
      'At least one "cancelled" terminal state',
    );
  }

  // ── transitions ──
  const transitions: TransitionDef[] = [];
  const keys = new Set<string>();
  raw.transitions.forEach((t, i) => {
    const at = `transitions[${i}]`;
    if (!isObj(t)) {
      issue(at, 'invalid_transition', 'Each transition must be an object');
      return;
    }
    const from = states.get(t.from as string);
    const to = states.get(t.to as string);
    if (!from || !to) {
      issue(
        at,
        'unknown_state',
        `"${String(t.from)}" → "${String(t.to)}" names an unknown state`,
      );
      return;
    }
    if (!isStr(t.action) || !CODE.test(t.action)) {
      issue(
        at,
        'invalid_action',
        'Action codes are lowercase letters, digits and _',
      );
      return;
    }
    const label = `${from.code} --${t.action}--> ${to.code}`;
    if (isTerminal(from.category)) {
      issue(
        at,
        'from_terminal',
        `${label}: nothing may leave terminal state "${from.code}"`,
      );
    }
    if (from.code === to.code)
      issue(at, 'self_loop', `${label}: a transition must change state`);

    const derived = t.action === DERIVED_ACTION;
    const key = derived
      ? `${from.code}|${t.action}|${to.code}`
      : `${from.code}|${t.action}`;
    if (keys.has(key)) {
      issue(
        at,
        'duplicate_action',
        derived
          ? `${label} is defined twice`
          : `"${from.code}" already has an "${t.action}" action — one action, one target`,
      );
    }
    keys.add(key);

    const sides = t.allowedSides;
    if (
      !isStrList(sides) ||
      !sides.length ||
      !sides.every((s) => TRANSITION_SIDES.includes(s as TransitionSide)) ||
      new Set(sides).size !== sides.length
    ) {
      issue(
        at,
        'invalid_sides',
        `${label}: allowedSides is a list of ${TRANSITION_SIDES.join(', ')}`,
      );
    } else if (derived && (sides.length !== 1 || sides[0] !== 'system')) {
      issue(
        at,
        'invalid_sides',
        `${label}: derived changes are made by the system only`,
      );
    }

    const roles = t.allowedRoles ?? [];
    if (!isStrList(roles)) {
      issue(at, 'invalid_roles', `${label}: allowedRoles is a list`);
    } else {
      for (const r of roles) {
        if (!KNOWN_ROLES.includes(r))
          issue(at, 'unknown_role', `${label}: no role "${r}"`);
      }
    }

    const required = t.requiredFields ?? [];
    if (!isStrList(required) || !required.every((f) => CODE.test(f))) {
      issue(
        at,
        'invalid_required_fields',
        `${label}: requiredFields are input keys`,
      );
    }
    if (
      t.requiresReason !== undefined &&
      typeof t.requiresReason !== 'boolean'
    ) {
      issue(
        at,
        'invalid_reason_flag',
        `${label}: requiresReason is true or false`,
      );
    }

    const effects = t.effects ?? [];
    const okEffects: { code: string; params?: Record<string, unknown> }[] = [];
    if (!Array.isArray(effects)) {
      issue(at, 'invalid_effects', `${label}: effects is a list`);
    } else {
      effects.forEach((e) => {
        if (!isObj(e) || !isStr(e.code) || !knownEffects.has(e.code)) {
          const name = isObj(e) && isStr(e.code) ? e.code : String(e);
          issue(at, 'unknown_effect', `${label}: no effect handler "${name}"`);
          return;
        }
        if (okEffects.some((x) => x.code === e.code)) {
          issue(at, 'duplicate_effect', `${label}: ${e.code} is listed twice`);
          return;
        }
        if (e.params !== undefined && !isObj(e.params)) {
          issue(
            at,
            'invalid_effect_params',
            `${label}: params of ${e.code} must be an object`,
          );
          return;
        }
        okEffects.push({
          code: e.code,
          ...(e.params ? { params: e.params } : {}),
        });
      });
    }

    transitions.push({
      from: from.code,
      to: to.code,
      action: t.action,
      allowedRoles: isStrList(roles) ? roles : [],
      allowedSides: (isStrList(sides) ? sides : []) as TransitionSide[],
      requiredFields: isStrList(required) ? required : [],
      requiresReason: t.requiresReason === true,
      effects: okEffects,
    });
  });

  // ── graph: reachability and dead ends ──
  if (initial.length === 1) {
    const reached = reachable(initial[0].code, transitions);
    for (const s of states.values()) {
      if (!reached.has(s.code)) {
        issue(
          'states',
          'unreachable_state',
          `"${s.code}" cannot be reached from "${initial[0].code}"`,
        );
      }
    }
  }
  for (const s of states.values()) {
    if (
      !isTerminal(s.category) &&
      !transitions.some((t) => t.from === s.code)
    ) {
      issue(
        'states',
        'dead_end',
        `"${s.code}" is not terminal but nothing leads out of it`,
      );
    }
  }

  return { issues, definition: { states: [...states.values()], transitions } };
}

function reachable(start: string, transitions: TransitionDef[]): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const at = queue.shift()!;
    for (const t of transitions) {
      if (t.from === at && !seen.has(t.to)) {
        seen.add(t.to);
        queue.push(t.to);
      }
    }
  }
  return seen;
}

export interface SimulationRun {
  terminal: string;
  /** Shortest action path from the initial state; null = unreachable. */
  path: { from: string; action: string; to: string }[] | null;
}

/**
 * Test run (lab ERD §18): walks from the initial state to every terminal
 * state along the shortest path, without touching data or notifications.
 */
export function simulateWorkflow(def: WorkflowDefinition): SimulationRun[] {
  const initial = def.states.find((s) => s.category === 'initial');
  const terminals = def.states.filter((s) => isTerminal(s.category));
  if (!initial) return terminals.map((t) => ({ terminal: t.code, path: null }));

  const prev = new Map<string, TransitionDef>();
  const seen = new Set([initial.code]);
  const queue = [initial.code];
  while (queue.length) {
    const at = queue.shift()!;
    for (const t of def.transitions) {
      if (t.from === at && !seen.has(t.to)) {
        seen.add(t.to);
        prev.set(t.to, t);
        queue.push(t.to);
      }
    }
  }
  return terminals.map((t) => {
    if (!seen.has(t.code)) return { terminal: t.code, path: null };
    const path: SimulationRun['path'] = [];
    for (let at = t.code; at !== initial.code; ) {
      const step = prev.get(at)!;
      path.unshift({ from: step.from, action: step.action, to: step.to });
      at = step.from;
    }
    return { terminal: t.code, path };
  });
}
