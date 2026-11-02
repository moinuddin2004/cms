export * from './types'
export { planTotals } from './utils/planMath'
export type { PlanTotals } from './utils/planMath'
export {
  planKeys,
  SERVICE_CATALOG_KEY,
  useAcceptPlan,
  useCancelPlan,
  useRecordPlanSession,
  useServiceCatalog,
  useSetPlanDiscount,
  useTreatmentPlans,
} from './hooks/useTreatmentPlans'
export {
  discountKindField,
  refineDiscount,
} from './schemas/treatmentPlan.schema'
export {
  DiscountInputs,
  PlanTotalsView,
  ServiceSelect,
} from './components/PlanPricing'
export { TreatmentPlanSheet } from './components/TreatmentPlanSheet'
export { PlanDiscountSheet } from './components/PlanDiscountSheet'
