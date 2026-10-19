import { FIELD_TYPES } from '../types'
import type { FieldDef, FormUi, ToothAnswer } from '../types'

/**
 * Pure helpers behind the form preview. They read draft JSON tolerantly —
 * a draft is work in progress, and the server's `issues` report what is
 * wrong — and mirror the server validator where behaviour matters
 * (visibleIf, empty answers), so the preview shows what an order form will.
 */

export type JsonParse =
  | { ok: true; value: unknown }
  | { ok: false; error: string }

/** Empty text = null (optional JSON blocks). */
export function parseJson(text: string): JsonParse {
  if (!text.trim()) return { ok: true, value: null }
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

export const toJsonText = (value: unknown): string =>
  value === null || value === undefined ? '' : JSON.stringify(value, null, 2)

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** The fields of `schema_json` the preview can render; others are skipped. */
export function readFields(schemaJson: unknown): FieldDef[] {
  if (!isObj(schemaJson) || !Array.isArray(schemaJson.fields)) return []
  return schemaJson.fields.filter(
    (f): f is FieldDef =>
      isObj(f) &&
      typeof f.key === 'string' &&
      typeof f.type === 'string' &&
      (FIELD_TYPES as readonly string[]).includes(f.type),
  )
}

export const isEmptyAnswer = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0)

/**
 * Keys of the fields that show for these answers. Like the server, a field
 * is visible when its (earlier, itself visible) controlling field has one
 * of the listed values.
 */
export function visibleKeys(
  fields: FieldDef[],
  answers: Record<string, unknown>,
): Set<string> {
  const shown = new Set<string>()
  const value: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.visibleIf && isObj(f.visibleIf)) {
      const other = value[f.visibleIf.field]
      if (other === undefined) continue
      const values = Array.isArray(other) ? other : [other]
      const wanted = Array.isArray(f.visibleIf.in) ? f.visibleIf.in : []
      if (!wanted.some((v) => values.includes(v))) continue
    }
    shown.add(f.key)
    const answer = answers[f.key]
    if (!isEmptyAnswer(answer)) value[f.key] = answer
  }
  return shown
}

/** Starting answers: each field's `defaultValue`. */
export function initialAnswers(fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue
  }
  return out
}

/** Answers to send for checking: visible, non-empty fields only. */
export function answersToSend(
  fields: FieldDef[],
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const shown = visibleKeys(fields, answers)
  return Object.fromEntries(
    Object.entries(answers).filter(
      ([k, v]) => shown.has(k) && !isEmptyAnswer(v),
    ),
  )
}

export interface PreviewSection {
  title: string | null
  fields: FieldDef[]
}

/** Fields grouped by `ui_json.sections`; unlisted fields go last. */
export function sectionsFor(fields: FieldDef[], ui: unknown): PreviewSection[] {
  const sections = isObj(ui) && Array.isArray((ui as FormUi).sections)
  if (!sections) return [{ title: null, fields }]
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const used = new Set<string>()
  const out: PreviewSection[] = []
  for (const s of (ui as FormUi).sections ?? []) {
    if (!isObj(s) || !Array.isArray(s.fields)) continue
    const list = s.fields
      .map((k) => byKey.get(k))
      .filter((f): f is FieldDef => !!f && !used.has(f.key))
    list.forEach((f) => used.add(f.key))
    if (list.length)
      out.push({
        title: typeof s.title === 'string' ? s.title : null,
        fields: list,
      })
  }
  const rest = fields.filter((f) => !used.has(f.key))
  if (rest.length)
    out.push({ title: out.length ? 'Other' : null, fields: rest })
  return out
}

// ── FDI tooth chart ────────────────────────────────────────────────────

const quadrant = (q: number, n: number, reverse: boolean) => {
  const teeth = Array.from({ length: n }, (_, i) => `${q}${i + 1}`)
  return reverse ? teeth.reverse() : teeth
}

/**
 * Chart rows as the dentist sees the mouth: upper right (1x / 5x) to upper
 * left (2x / 6x), then lower right (4x / 8x) to lower left (3x / 7x).
 */
export function fdiRows(dentition: 'permanent' | 'primary') {
  const [ur, ul, ll, lr, n] =
    dentition === 'permanent' ? [1, 2, 3, 4, 8] : [5, 6, 7, 8, 5]
  return {
    upper: [quadrant(ur, n, true), quadrant(ul, n, false)],
    lower: [quadrant(lr, n, true), quadrant(ll, n, false)],
  }
}

/** Tooth chart answers come back as objects; strings are accepted too. */
export function readTeeth(value: unknown): ToothAnswer[] {
  if (!Array.isArray(value)) return []
  return value
    .map((t): ToothAnswer | null =>
      typeof t === 'string'
        ? { tooth: t }
        : isObj(t) && typeof t.tooth === 'string'
          ? (t as unknown as ToothAnswer)
          : null,
    )
    .filter((t): t is ToothAnswer => !!t)
}
