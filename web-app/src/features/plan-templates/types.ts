/** The kind of treatment a plan covers. Mirrors the backend `PlanTemplateCategory`. */
export enum PlanTemplateCategory {
  GENERAL = 'GENERAL',
  PREVENTIVE = 'PREVENTIVE',
  RESTORATIVE = 'RESTORATIVE',
  ENDODONTICS = 'ENDODONTICS',
  PERIODONTICS = 'PERIODONTICS',
  ORAL_SURGERY = 'ORAL_SURGERY',
  PROSTHODONTICS = 'PROSTHODONTICS',
  IMPLANTOLOGY = 'IMPLANTOLOGY',
  ORTHODONTICS = 'ORTHODONTICS',
  PEDIATRIC = 'PEDIATRIC',
  COSMETIC = 'COSMETIC',
  GERIATRIC = 'GERIATRIC',
  ORAL_MEDICINE = 'ORAL_MEDICINE',
  TMJ_AND_OROFACIAL_PAIN = 'TMJ_AND_OROFACIAL_PAIN',
  FULL_MOUTH_REHABILITATION = 'FULL_MOUTH_REHABILITATION',
  EMERGENCY = 'EMERGENCY',
  OTHER = 'OTHER',
}

export const PLAN_TEMPLATE_CATEGORY_LABELS: Record<
  PlanTemplateCategory,
  string
> = {
  [PlanTemplateCategory.GENERAL]: 'General',
  [PlanTemplateCategory.PREVENTIVE]: 'Preventive',
  [PlanTemplateCategory.RESTORATIVE]: 'Restorative (fillings)',
  [PlanTemplateCategory.ENDODONTICS]: 'Endodontics (root canal)',
  [PlanTemplateCategory.PERIODONTICS]: 'Periodontics (gums)',
  [PlanTemplateCategory.ORAL_SURGERY]: 'Oral surgery',
  [PlanTemplateCategory.PROSTHODONTICS]: 'Prosthodontics (crowns, dentures)',
  [PlanTemplateCategory.IMPLANTOLOGY]: 'Implantology',
  [PlanTemplateCategory.ORTHODONTICS]: 'Orthodontics (braces)',
  [PlanTemplateCategory.PEDIATRIC]: 'Pediatric (children)',
  [PlanTemplateCategory.COSMETIC]: 'Cosmetic',
  [PlanTemplateCategory.GERIATRIC]: 'Geriatric',
  [PlanTemplateCategory.ORAL_MEDICINE]: 'Oral medicine',
  [PlanTemplateCategory.TMJ_AND_OROFACIAL_PAIN]: 'TMJ & orofacial pain',
  [PlanTemplateCategory.FULL_MOUTH_REHABILITATION]: 'Full-mouth rehabilitation',
  [PlanTemplateCategory.EMERGENCY]: 'Emergency',
  [PlanTemplateCategory.OTHER]: 'Other',
}

/** Dropdown options: General first, Other last, the rest A–Z. */
export const PLAN_TEMPLATE_CATEGORY_OPTIONS = Object.values(
  PlanTemplateCategory,
)
  .map((value) => ({ value, label: PLAN_TEMPLATE_CATEGORY_LABELS[value] }))
  .sort((a, b) => {
    if (a.value === PlanTemplateCategory.GENERAL) return -1
    if (b.value === PlanTemplateCategory.GENERAL) return 1
    if (a.value === PlanTemplateCategory.OTHER) return 1
    if (b.value === PlanTemplateCategory.OTHER) return -1
    return a.label.localeCompare(b.label)
  })

/** One procedure of a template; becomes a plan item when the template is used. */
export interface PlanTemplateItem {
  procedureName: string
  estimatedSessions: number
  /** The clinic's usual fee; null until the clinic sets it. */
  estimatedCost: number | null
  notes: string | null
}

/**
 * A predefined treatment plan (Root Canal, Implant…) a doctor picks for a
 * patient. Not the same as a prescription preset, which is a set of medicines.
 */
export interface PlanTemplate {
  id: string
  name: string
  category: PlanTemplateCategory
  description: string | null
  items: PlanTemplateItem[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PlanTemplateInput {
  name: string
  category: PlanTemplateCategory
  description: string | null
  items: PlanTemplateItem[]
}

/** Total of the procedure fees that are set; null when none is. */
export function templateTotalCost(items: PlanTemplateItem[]): number | null {
  const fees = items
    .map((i) => (i.estimatedCost == null ? null : Number(i.estimatedCost)))
    .filter((f): f is number => f !== null && !Number.isNaN(f))
  return fees.length === 0 ? null : fees.reduce((a, b) => a + b, 0)
}
