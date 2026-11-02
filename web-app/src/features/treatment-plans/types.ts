/** Mirrors the backend `DiscountKind`. */
export type DiscountKind = 'PERCENTAGE' | 'FIXED'

export enum TreatmentPlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum PlanItemStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  POSTPONED = 'postponed',
}

/**
 * A catalog service the doctor can pick. `price` (this location's) only
 * arrives for users who may see prices.
 */
export interface ServiceOption {
  id: string
  name: string
  code: string | null
  price?: number
}

/** One service of a patient's plan; its price is locked on the plan. */
export interface TreatmentPlanItem {
  id: string
  planId: string
  serviceId: string | null
  procedureName: string
  toothNumber: string | null
  estimatedSessions: number
  completedSessions: number
  /** Locked plan price — absent without price permission. */
  estimatedCost?: number | null
  status: PlanItemStatus
  sequenceOrder: number
  assignedTo: string | null
  notes: string | null
}

export interface TreatmentPlan {
  id: string
  patientId: string
  dentistId: string
  planNumber: string
  planName: string
  notes: string | null
  planTemplateId: string | null
  status: TreatmentPlanStatus
  patientAccepted: boolean
  /** Money fields are absent without price permission. */
  estimatedCost?: number | null
  discountAmount?: number
  finalEstimatedCost?: number | null
  discountKind?: DiscountKind | null
  discountValue?: number | null
  /** The plan's one invoice, issued at its first session. */
  invoiceId: string | null
  startedAt: string | null
  startDate: string | null
  actualEndDate: string | null
  createdAt: string
  items: TreatmentPlanItem[]
}

export interface PlanLineInput {
  id?: string
  serviceId: string
  toothNumber: string | null
  estimatedSessions: number
  notes: string | null
}

export interface TreatmentPlanInput {
  planName?: string
  planTemplateId?: string
  dentistId?: string
  /** The visit it is made in; completing that visit bills the plan. */
  encounterId?: string
  notes: string | null
  items: PlanLineInput[]
  /** Only sent by users who may give a discount. */
  discountKind?: DiscountKind | null
  discountValue?: number | null
}

/** Not closed: still being planned or being worked through. */
export const isOpenPlan = (p: Pick<TreatmentPlan, 'status'>) =>
  p.status === TreatmentPlanStatus.DRAFT ||
  p.status === TreatmentPlanStatus.ACTIVE

/** "RCT #36" */
export const stepLabel = (
  i: Pick<TreatmentPlanItem, 'procedureName' | 'toothNumber'>,
) => (i.toothNumber ? `${i.procedureName} #${i.toothNumber}` : i.procedureName)

/** A step can take another session. */
export const stepOpen = (i: TreatmentPlanItem) =>
  i.status !== PlanItemStatus.SKIPPED &&
  i.completedSessions < i.estimatedSessions
