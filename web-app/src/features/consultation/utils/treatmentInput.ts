import type { ProcedureOption, TreatmentInput } from '../types'

/** Sentinel for "none of the catalog procedures": the doctor types a name instead. */
export const OTHER_PROCEDURE = 'other'

/** More procedures than this get a search box above the chips. */
export const SEARCH_THRESHOLD = 10

export interface TreatmentDraft {
  /** A catalog service id, `OTHER_PROCEDURE`, or null while nothing is picked. */
  selected: string | null
  /** Typed name — used for "Other", and for clinics without a catalog. */
  name: string
  tooth: string
}

/**
 * The body for `POST /encounters/:id/treatments`, or null while the draft is
 * incomplete. A picked service goes by id (billing prices it); a typed name
 * carries no price and reception prices the charge. Never a fee.
 */
export function buildTreatmentInput(
  draft: TreatmentDraft,
  catalog: ProcedureOption[],
): TreatmentInput | null {
  const notes = draft.tooth.trim() ? `Tooth: ${draft.tooth.trim()}` : undefined
  const picked = catalog.find((p) => p.id === draft.selected)
  if (picked) return { serviceId: picked.id, notes }
  const name = draft.name.trim()
  const typing = catalog.length === 0 || draft.selected === OTHER_PROCEDURE
  if (typing && name) return { treatmentName: name, notes }
  return null
}

/** Case-insensitive name/code filter for the procedure chips. */
export function filterProcedures(
  catalog: ProcedureOption[],
  query: string,
): ProcedureOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return catalog
  return catalog.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.code ?? '').toLowerCase().includes(q),
  )
}
