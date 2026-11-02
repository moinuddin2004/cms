// Doctor compensation / commissions. Money is integer minor units and rates are
// integer basis points (4000 = 40.00%) — never floats.

import type { ServiceKind } from './billing.types'

export type CompensationPlanType =
  'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION'

export type CommissionBasis = 'NET' | 'GROSS'

export interface CommissionRule {
  id: string
  serviceId: string | null
  serviceName: string | null
  serviceCategory: ServiceKind | null
  rateBps: number | null
  fixedAmountMinor: number | null
}

export interface CompensationPlan {
  id: string
  assignmentId: string
  type: CompensationPlanType
  baseSalaryMinor: number | null
  defaultRateBps: number | null
  commissionBasis: CommissionBasis
  effectiveFrom: string
  effectiveTo: string | null
  isCurrent: boolean
  rules: CommissionRule[]
  createdAt: string
}

export interface CompensationOverview {
  assignmentId: string
  /** Clinic date at the location, from the server. */
  today: string
  canConsult: boolean
  current: CompensationPlan | null
  versions: CompensationPlan[]
}

export interface CommissionRuleInput {
  serviceId?: string
  serviceCategory?: ServiceKind
  rateBps?: number
  fixedAmountMinor?: number
}

export interface CompensationPlanInput {
  type: CompensationPlanType
  baseSalaryMinor?: number
  defaultRateBps?: number
  commissionBasis?: CommissionBasis
  effectiveFrom?: string
  rules?: CommissionRuleInput[]
}

export type CommissionSourceType =
  'ALLOCATION' | 'UNAPPLY' | 'CHARGE_ADJUST' | 'VOID' | 'MANUAL'

export interface CommissionEntryRow {
  id: string
  createdAt: string
  assignmentId: string
  doctorName: string
  chargeId: string
  chargeDescription: string
  patientName: string
  invoiceNumber: string | null
  sourceType: CommissionSourceType
  baseMinor: number
  rateBps: number | null
  amountMinor: number
  settled: boolean
}

export interface DoctorEarningsRow {
  assignmentId: string
  employeeId: string
  doctorName: string
  locationName: string
  planType: CompensationPlanType | null
  collectedMinor: number
  earnedMinor: number
  settledMinor: number
  pendingMinor: number
}

export interface DoctorEarningsReport {
  rows: DoctorEarningsRow[]
  totals: {
    collectedMinor: number
    earnedMinor: number
    settledMinor: number
    pendingMinor: number
  }
}

export interface MyEarnings {
  rows: DoctorEarningsRow[]
  totals: DoctorEarningsReport['totals']
  entries: CommissionEntryRow[]
}
