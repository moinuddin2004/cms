import type {
  Issue,
  StateDef,
  TransitionDef,
  WorkflowDefinition,
} from '../types'
import { DERIVED_ACTION } from '../types'

/**
 * Pure edits behind the workflow table editor. The definition stays plain
 * JSON (what the draft stores); the server checks it on save.
 */

/** A stored definition as it may be: drafts are work in progress. */
interface LooseDefinition {
  states?: Partial<StateDef>[]
  transitions?: Partial<TransitionDef>[]
}

/** Fill in the optional lists so the table always has something to bind. */
export function normalizeDefinition(
  def: LooseDefinition | null | undefined,
): WorkflowDefinition {
  return {
    states: (def?.states ?? []).map((s) => ({
      code: s.code ?? '',
      name: s.name ?? '',
      category: s.category ?? 'active',
    })),
    transitions: (def?.transitions ?? []).map((t) => ({
      from: t.from ?? '',
      to: t.to ?? '',
      action: t.action ?? '',
      allowedSides: t.allowedSides ?? [],
      allowedRoles: t.allowedRoles ?? [],
      requiredFields: t.requiredFields ?? [],
      requiresReason: t.requiresReason ?? false,
      effects: t.effects ?? [],
    })),
  }
}

export function updateState(
  def: WorkflowDefinition,
  index: number,
  patch: Partial<StateDef>,
): WorkflowDefinition {
  const old = def.states[index]
  const states = def.states.map((s, i) =>
    i === index ? { ...s, ...patch } : s,
  )
  // Renaming a code carries its transitions along.
  const renamed =
    patch.code !== undefined && old.code && patch.code !== old.code
      ? { from: old.code, to: patch.code }
      : null
  const transitions = renamed
    ? def.transitions.map((t) => ({
        ...t,
        from: t.from === renamed.from ? renamed.to : t.from,
        to: t.to === renamed.from ? renamed.to : t.to,
      }))
    : def.transitions
  return { states, transitions }
}

/** Removes a state and every transition into or out of it. */
export function removeState(
  def: WorkflowDefinition,
  index: number,
): WorkflowDefinition {
  const code = def.states[index]?.code
  return {
    states: def.states.filter((_, i) => i !== index),
    transitions: code
      ? def.transitions.filter((t) => t.from !== code && t.to !== code)
      : def.transitions,
  }
}

export function updateTransition(
  def: WorkflowDefinition,
  index: number,
  patch: Partial<TransitionDef>,
): WorkflowDefinition {
  return {
    ...def,
    transitions: def.transitions.map((t, i) => {
      if (i !== index) return t
      const next = { ...t, ...patch }
      // Derived edges are computed by the engine: system side, no roles.
      if (next.action.trim() === DERIVED_ACTION) {
        next.allowedSides = ['system']
        next.allowedRoles = []
      }
      return next
    }),
  }
}

export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by
  if (to < 0 || to >= list.length) return list
  const out = [...list]
  ;[out[index], out[to]] = [out[to], out[index]]
  return out
}

/**
 * Issues per row, from paths like `states[2].code` / `transitions[0]`;
 * the rest (whole-definition issues) under `general`.
 */
export function issuesByRow(issues: Issue[]) {
  const states = new Map<number, Issue[]>()
  const transitions = new Map<number, Issue[]>()
  const general: Issue[] = []
  for (const i of issues) {
    const m = /^(states|transitions)\[(\d+)\]/.exec(i.path)
    if (!m) {
      general.push(i)
      continue
    }
    const map = m[1] === 'states' ? states : transitions
    const n = Number(m[2])
    map.set(n, [...(map.get(n) ?? []), i])
  }
  return { states, transitions, general }
}
