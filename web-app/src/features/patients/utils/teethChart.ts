/**
 * Teeth chart data model (FDI notation).
 *
 * `chartData` is stored as jsonb keyed by FDI tooth number. Each tooth holds
 * an optional whole-tooth condition, an optional root canal, per-surface marks
 * and a note. Every finding is either existing (already there / done) or
 * planned (to be treated). Older charts stored `"16": "CARIES"` or
 * `{ condition: 'CARIES' }` for the whole tooth; `normalizeChart` reads both.
 */

export type Dentition = 'permanent' | 'primary'
export type Surface = 'M' | 'O' | 'I' | 'D' | 'B' | 'L'
export type SurfaceCondition = 'CARIES' | 'FILLED'
export type ToothCondition =
  'CROWN' | 'IMPLANT' | 'EXTRACTION_NEEDED' | 'MISSING'
export type ChartCondition = SurfaceCondition | ToothCondition | 'ROOT_CANAL'

export type SurfaceMark = { condition: SurfaceCondition; planned?: boolean }
export type ToothEntry = {
  condition?: ToothCondition
  planned?: boolean
  rootCanal?: { planned?: boolean }
  surfaces?: Partial<Record<Surface, SurfaceMark>>
  note?: string
}
export type ChartData = Record<string, ToothEntry>

type ConditionMeta = {
  label: string
  /** Where it is marked: one surface, or the whole tooth. */
  scope: 'surface' | 'tooth'
  /** Tailwind classes for the SVG rendering and the legend dot. */
  fill: string
  stroke: string
  dot: string
  /** Extraction is always a plan: a tooth already out is "Missing". */
  alwaysPlanned?: boolean
}

export const CONDITIONS: Record<ChartCondition, ConditionMeta> = {
  CARIES: {
    label: 'Caries',
    scope: 'surface',
    fill: 'fill-red-500',
    stroke: 'stroke-red-700',
    dot: 'bg-red-500 border-red-700',
  },
  FILLED: {
    label: 'Filled',
    scope: 'surface',
    fill: 'fill-blue-500',
    stroke: 'stroke-blue-700',
    dot: 'bg-blue-500 border-blue-700',
  },
  CROWN: {
    label: 'Crown',
    scope: 'tooth',
    fill: 'fill-violet-500',
    stroke: 'stroke-violet-700',
    dot: 'bg-violet-500 border-violet-700',
  },
  ROOT_CANAL: {
    label: 'Root canal',
    scope: 'tooth',
    fill: 'fill-amber-500',
    stroke: 'stroke-amber-700',
    dot: 'bg-amber-500 border-amber-700',
  },
  IMPLANT: {
    label: 'Implant',
    scope: 'tooth',
    fill: 'fill-teal-500',
    stroke: 'stroke-teal-700',
    dot: 'bg-teal-500 border-teal-700',
  },
  EXTRACTION_NEEDED: {
    label: 'Extraction',
    scope: 'tooth',
    fill: 'fill-orange-500',
    stroke: 'stroke-orange-700',
    dot: 'bg-orange-500 border-orange-700',
    alwaysPlanned: true,
  },
  MISSING: {
    label: 'Missing',
    scope: 'tooth',
    fill: 'fill-transparent',
    stroke: 'stroke-slate-400',
    dot: 'bg-transparent border-dashed border-slate-400',
  },
}

export const SURFACE_CONDITIONS: SurfaceCondition[] = ['CARIES', 'FILLED']
export const TOOTH_TOOLS: (ToothCondition | 'ROOT_CANAL')[] = [
  'CROWN',
  'ROOT_CANAL',
  'IMPLANT',
  'EXTRACTION_NEEDED',
  'MISSING',
]

// FDI numbers left→right as seen facing the patient.
export const ARCHES: Record<Dentition, { upper: number[]; lower: number[] }> = {
  permanent: {
    upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  },
  primary: {
    upper: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
    lower: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
  },
}

export type ToothKind = 'molar' | 'premolar' | 'canine' | 'incisor'

export const isPrimaryTooth = (t: number) => t > 50
export const dentitionOf = (t: number): Dentition =>
  isPrimaryTooth(t) ? 'primary' : 'permanent'
export const isUpperTooth = (t: number) =>
  [1, 2, 5, 6].includes(Math.floor(t / 10))
/** Incisors and canines: their biting surface is an edge (I), not O. */
export const isAnterior = (t: number) => t % 10 <= 3

export function toothKind(t: number): ToothKind {
  const pos = t % 10
  if (pos <= 2) return 'incisor'
  if (pos === 3) return 'canine'
  if (isPrimaryTooth(t) || pos >= 6) return 'molar'
  return 'premolar'
}

const QUADRANT = ['', 'Upper right', 'Upper left', 'Lower left', 'Lower right']
const PERMANENT_NAMES = [
  '',
  'central incisor',
  'lateral incisor',
  'canine',
  'first premolar',
  'second premolar',
  'first molar',
  'second molar',
  'third molar',
]
const PRIMARY_NAMES = [
  '',
  'central incisor',
  'lateral incisor',
  'canine',
  'first molar',
  'second molar',
]

export function toothName(t: number): string {
  const q = Math.floor(t / 10)
  const quadrant = QUADRANT[q > 4 ? q - 4 : q]
  const names = isPrimaryTooth(t) ? PRIMARY_NAMES : PERMANENT_NAMES
  return `${quadrant} ${names[t % 10]}${isPrimaryTooth(t) ? ' (primary)' : ''}`
}

/** The five surfaces of a tooth, in chart order (M, O/I, D, B, L). */
export const surfacesOf = (t: number): Surface[] => [
  'M',
  isAnterior(t) ? 'I' : 'O',
  'D',
  'B',
  'L',
]

export function surfaceName(t: number, s: Surface): string {
  switch (s) {
    case 'M':
      return 'Mesial'
    case 'D':
      return 'Distal'
    case 'O':
      return 'Occlusal'
    case 'I':
      return 'Incisal'
    case 'B':
      return isAnterior(t) ? 'Labial' : 'Buccal'
    case 'L':
      return isUpperTooth(t) ? 'Palatal' : 'Lingual'
  }
}

const SURFACE_ORDER = 'MOIDBL'
export const surfaceCode = (list: Surface[]) =>
  [...list]
    .sort((a, b) => SURFACE_ORDER.indexOf(a) - SURFACE_ORDER.indexOf(b))
    .join('')

/** Surfaces don't apply to a tooth that is gone or replaced by an implant. */
export const hasSurfaces = (e?: ToothEntry) =>
  e?.condition !== 'MISSING' && e?.condition !== 'IMPLANT'

// ── Reading stored data ─────────────────────────────────────

const TOOTH_CONDITIONS = new Set<string>([
  'CROWN',
  'IMPLANT',
  'EXTRACTION_NEEDED',
  'MISSING',
])
const SURFACE_SET = new Set<string>(SURFACE_CONDITIONS)

function normalizeEntry(tooth: number, raw: unknown): ToothEntry | null {
  const v = (typeof raw === 'string' ? { condition: raw } : raw) as Record<
    string,
    any
  > | null
  if (!v || typeof v !== 'object') return null
  const out: ToothEntry = {}
  if (TOOTH_CONDITIONS.has(v.condition)) {
    out.condition = v.condition
    if (v.planned || v.condition === 'EXTRACTION_NEEDED') out.planned = true
  } else if (SURFACE_SET.has(v.condition)) {
    // Legacy whole-tooth caries / filling → every surface.
    out.surfaces = {}
    for (const s of surfacesOf(tooth))
      out.surfaces[s] = { condition: v.condition, planned: !!v.planned }
  }
  if (v.rootCanal) out.rootCanal = { planned: !!v.rootCanal.planned }
  if (v.surfaces && typeof v.surfaces === 'object') {
    out.surfaces = { ...out.surfaces }
    for (const [s, m] of Object.entries(v.surfaces as Record<string, any>)) {
      if (m && SURFACE_SET.has(m.condition))
        out.surfaces[s as Surface] = {
          condition: m.condition,
          planned: !!m.planned,
        }
    }
  }
  if (typeof v.note === 'string' && v.note.trim()) out.note = v.note
  return isEmpty(out) ? null : out
}

export function normalizeChart(
  chartData: Record<string, unknown> | null | undefined,
): ChartData {
  const out: ChartData = {}
  for (const [k, v] of Object.entries(chartData || {})) {
    const e = normalizeEntry(Number(k), v)
    if (e) out[k] = e
  }
  return out
}

/** Payload for saving: notes trimmed, empty teeth and `planned: false` dropped. */
export function serializeChart(data: ChartData): ChartData {
  const out: ChartData = {}
  for (const [k, e] of Object.entries(data)) {
    const c: ToothEntry = {}
    if (e.condition) {
      c.condition = e.condition
      if (e.planned) c.planned = true
    }
    if (e.rootCanal) c.rootCanal = e.rootCanal.planned ? { planned: true } : {}
    const surfaces = Object.entries(e.surfaces ?? {})
    if (surfaces.length)
      c.surfaces = Object.fromEntries(
        surfaces.map(([s, m]) => [
          s,
          m.planned
            ? { condition: m.condition, planned: true }
            : { condition: m.condition },
        ]),
      )
    if (e.note?.trim()) c.note = e.note.trim()
    if (!isEmpty(c)) out[k] = c
  }
  return out
}

function isEmpty(e: ToothEntry) {
  return (
    !e.condition &&
    !e.rootCanal &&
    !Object.keys(e.surfaces ?? {}).length &&
    !e.note?.trim()
  )
}

// ── Editing (pure) ──────────────────────────────────────────

/** The tooth's entry, or undefined when it has nothing charted. */
export const entryOf = (
  data: ChartData,
  tooth: number,
): ToothEntry | undefined =>
  Object.hasOwn(data, String(tooth)) ? data[String(tooth)] : undefined

function withEntry(
  data: ChartData,
  tooth: number,
  update: (e: ToothEntry) => ToothEntry,
): ChartData {
  const key = String(tooth)
  const cur = entryOf(data, tooth)
  const next = update({ ...cur, surfaces: { ...cur?.surfaces } })
  if (!Object.keys(next.surfaces ?? {}).length) delete next.surfaces
  // Nothing changed → same object, so callers can skip undo history.
  if (JSON.stringify(next) === JSON.stringify(cur ?? {})) return data
  const out = { ...data }
  if (isEmpty(next)) delete out[key]
  else out[key] = next
  return out
}

const samePlan = (a: boolean | undefined, b: boolean) => !!a === b

/**
 * Apply a condition to a tooth (or one surface of it). Applying the same
 * condition with the same existing/planned status again removes it.
 */
export function applyCondition(
  data: ChartData,
  tooth: number,
  condition: ChartCondition,
  planned: boolean,
  surface?: Surface,
): ChartData {
  const meta = CONDITIONS[condition]
  const isPlanned = meta.alwaysPlanned ? true : planned
  return withEntry(data, tooth, (e) => {
    if (meta.scope === 'surface') {
      if (!surface || !hasSurfaces(e)) return e
      const cur = e.surfaces![surface]
      if (cur?.condition === condition && samePlan(cur.planned, isPlanned))
        delete e.surfaces![surface]
      else
        e.surfaces![surface] = {
          condition: condition as SurfaceCondition,
          planned: isPlanned,
        }
      return e
    }
    if (condition === 'ROOT_CANAL') {
      if (!hasSurfaces(e)) return e
      if (e.rootCanal && samePlan(e.rootCanal.planned, isPlanned))
        delete e.rootCanal
      else e.rootCanal = { planned: isPlanned }
      return e
    }
    if (e.condition === condition && samePlan(e.planned, isPlanned)) {
      delete e.condition
      delete e.planned
      return e
    }
    e.condition = condition as ToothCondition
    e.planned = isPlanned
    // A missing tooth / implant has no surfaces or canals left to chart.
    if (!hasSurfaces(e)) {
      e.surfaces = {}
      delete e.rootCanal
    }
    return e
  })
}

/** Surface shortcut from the detail panel: empty → caries → filled → empty. */
export function cycleSurface(
  data: ChartData,
  tooth: number,
  surface: Surface,
  planned: boolean,
): ChartData {
  return withEntry(data, tooth, (e) => {
    if (!hasSurfaces(e)) return e
    const cur = e.surfaces![surface]
    if (!cur) e.surfaces![surface] = { condition: 'CARIES', planned }
    else if (cur.condition === 'CARIES')
      e.surfaces![surface] = { condition: 'FILLED', planned }
    else delete e.surfaces![surface]
    return e
  })
}

export function clearTooth(data: ChartData, tooth: number): ChartData {
  const out = { ...data }
  delete out[String(tooth)]
  return out
}

export function setToothNote(
  data: ChartData,
  tooth: number,
  note: string,
): ChartData {
  return withEntry(data, tooth, (e) => ({ ...e, note }))
}

// ── Findings (for lists, summaries, plans) ──────────────────

export type Finding = {
  /** Stable id within the tooth, used to edit / remove it. */
  id: string
  condition: ChartCondition
  planned: boolean
  surfaces: Surface[]
}

export function findingsOf(entry?: ToothEntry): Finding[] {
  if (!entry) return []
  const out: Finding[] = []
  if (entry.condition)
    out.push({
      id: 'tooth',
      condition: entry.condition,
      planned: !!entry.planned,
      surfaces: [],
    })
  if (entry.rootCanal)
    out.push({
      id: 'rootCanal',
      condition: 'ROOT_CANAL',
      planned: !!entry.rootCanal.planned,
      surfaces: [],
    })
  const groups = new Map<string, Finding>()
  for (const [s, m] of Object.entries(entry.surfaces ?? {})) {
    const id = `surface:${m.condition}:${m.planned ? 1 : 0}`
    const g = groups.get(id) ?? {
      id,
      condition: m.condition,
      planned: !!m.planned,
      surfaces: [],
    }
    g.surfaces.push(s as Surface)
    groups.set(id, g)
  }
  for (const g of groups.values()) {
    g.surfaces = surfaceCode(g.surfaces).split('') as Surface[]
    out.push(g)
  }
  return out
}

export const findingLabel = (f: Finding) =>
  CONDITIONS[f.condition].label +
  (f.surfaces.length ? ` ${surfaceCode(f.surfaces)}` : '')

function editFinding(
  data: ChartData,
  tooth: number,
  f: Finding,
  edit: (planned: boolean) => boolean | null,
): ChartData {
  return withEntry(data, tooth, (e) => {
    const next = edit(f.planned)
    if (f.id === 'tooth') {
      if (next === null) {
        delete e.condition
        delete e.planned
      } else e.planned = next
    } else if (f.id === 'rootCanal') {
      if (next === null) delete e.rootCanal
      else e.rootCanal = { planned: next }
    } else {
      for (const s of f.surfaces) {
        if (next === null) delete e.surfaces![s]
        else
          e.surfaces![s] = {
            condition: f.condition as SurfaceCondition,
            planned: next,
          }
      }
    }
    return e
  })
}

export const removeFinding = (data: ChartData, tooth: number, f: Finding) =>
  editFinding(data, tooth, f, () => null)

export const toggleFindingPlanned = (
  data: ChartData,
  tooth: number,
  f: Finding,
) => editFinding(data, tooth, f, (p) => !p)

/** Teeth with any finding, in FDI order. */
export const chartedTeeth = (data: ChartData) =>
  Object.keys(data)
    .map(Number)
    .filter((t) => findingsOf(data[t]).length > 0)
    .sort((a, b) => a - b)

export function chartStats(data: ChartData) {
  let findings = 0
  let planned = 0
  for (const e of Object.values(data))
    for (const f of findingsOf(e)) {
      findings++
      if (f.planned) planned++
    }
  return { teeth: chartedTeeth(data).length, findings, planned }
}

/** One treatment-plan line per tooth that has planned work. */
export function plannedWork(data: ChartData) {
  return chartedTeeth(data)
    .map((t) => ({
      tooth: t,
      findings: findingsOf(data[t]).filter((f) => f.planned),
    }))
    .filter((x) => x.findings.length > 0)
}
