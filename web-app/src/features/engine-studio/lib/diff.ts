import type {
  FieldDef,
  FormVersion,
  StateDef,
  TransitionDef,
  WorkflowVersion,
} from '../types'
import { readFields } from './form-preview'
import { normalizeDefinition } from './workflow-edit'

/**
 * Field-level diffs between two versions (lab ERD §18 "v1 vs v2"). Pure and
 * client-side: both versions come from their GET calls.
 */

export interface PropChange {
  prop: string
  before: unknown
  after: unknown
}

export interface ItemChange {
  key: string
  label: string
  changes: PropChange[]
}

export interface ListDiff<T> {
  added: T[]
  removed: T[]
  changed: ItemChange[]
}

/** JSON with sorted object keys, so key order never counts as a change. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

const same = (a: unknown, b: unknown) =>
  stableStringify(a) === stableStringify(b)

function propChanges(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  skip: string[] = [],
): PropChange[] {
  const props = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  return props
    .filter((p) => !skip.includes(p) && !same(a[p], b[p]))
    .map((prop) => ({ prop, before: a[prop], after: b[prop] }))
}

function diffBy<T extends object>(
  before: T[],
  after: T[],
  keyOf: (t: T) => string,
  labelOf: (t: T) => string,
  skip: string[] = [],
): ListDiff<T> {
  const a = new Map(before.map((t) => [keyOf(t), t]))
  const b = new Map(after.map((t) => [keyOf(t), t]))
  const changed: ItemChange[] = []
  for (const [key, next] of b) {
    const prev = a.get(key)
    if (!prev) continue
    const changes = propChanges(
      prev as Record<string, unknown>,
      next as Record<string, unknown>,
      skip,
    )
    if (changes.length) changed.push({ key, label: labelOf(next), changes })
  }
  return {
    added: after.filter((t) => !a.has(keyOf(t))),
    removed: before.filter((t) => !b.has(keyOf(t))),
    changed,
  }
}

export const diffCount = (d: ListDiff<unknown>) =>
  d.added.length + d.removed.length + d.changed.length

// ── Forms ─────────────────────────────────────────────────────────────

export interface FormDiff {
  fields: ListDiff<FieldDef>
  /** Promotions as `field → column` pairs. */
  promotions: ListDiff<{ field: string; column: string }>
  /** Field order changed (same keys, different order). */
  reordered: boolean
  layoutChanged: boolean
  total: number
}

const promotionList = (p: FormVersion['promotions']) =>
  Object.entries(p ?? {}).map(([field, column]) => ({ field, column }))

export function diffForm(a: FormVersion, b: FormVersion): FormDiff {
  const fa = readFields(a.schemaJson)
  const fb = readFields(b.schemaJson)
  const fields = diffBy(
    fa,
    fb,
    (f) => f.key,
    (f) => f.label || f.key,
    ['key'],
  )
  const promotions = diffBy(
    promotionList(a.promotions),
    promotionList(b.promotions),
    (p) => p.field,
    (p) => p.field,
    ['field'],
  )
  const common = (list: FieldDef[], other: FieldDef[]) =>
    list.map((f) => f.key).filter((k) => other.some((o) => o.key === k))
  const reordered = !same(common(fa, fb), common(fb, fa))
  const layoutChanged = !same(a.uiJson ?? null, b.uiJson ?? null)
  return {
    fields,
    promotions,
    reordered,
    layoutChanged,
    total:
      diffCount(fields) +
      diffCount(promotions) +
      (reordered ? 1 : 0) +
      (layoutChanged ? 1 : 0),
  }
}

// ── Workflows ─────────────────────────────────────────────────────────

export interface WorkflowDiff {
  states: ListDiff<StateDef>
  transitions: ListDiff<TransitionDef>
  total: number
}

export const transitionKey = (t: TransitionDef) =>
  `${t.from}|${t.action}|${t.to}`
export const transitionLabel = (t: TransitionDef) =>
  `${t.from} → ${t.to} (${t.action})`

export function diffWorkflow(
  a: WorkflowVersion,
  b: WorkflowVersion,
): WorkflowDiff {
  // Absent lists and flags mean "none", so normalise before comparing.
  const da = normalizeDefinition(a.definition)
  const db = normalizeDefinition(b.definition)
  const states = diffBy(
    da.states,
    db.states,
    (s) => s.code,
    (s) => s.code,
    ['code'],
  )
  const transitions = diffBy(
    da.transitions,
    db.transitions,
    transitionKey,
    transitionLabel,
    ['from', 'to', 'action'],
  )
  return {
    states,
    transitions,
    total: diffCount(states) + diffCount(transitions),
  }
}

/** Short text for a changed value in the diff table. */
export function formatValue(v: unknown): string {
  if (v === undefined || v === null) return '—'
  if (Array.isArray(v)) {
    if (!v.length) return '—'
    return v
      .map((x) =>
        x && typeof x === 'object' && 'code' in x
          ? String((x as { code: unknown }).code)
          : x && typeof x === 'object' && 'value' in x
            ? String((x as { value: unknown }).value)
            : typeof x === 'object'
              ? stableStringify(x)
              : String(x),
      )
      .join(', ')
  }
  if (typeof v === 'object') return stableStringify(v)
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}
