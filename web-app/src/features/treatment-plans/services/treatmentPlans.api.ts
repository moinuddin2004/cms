import api from '@/lib/api'
import type {
  DiscountKind,
  ServiceOption,
  TreatmentPlan,
  TreatmentPlanInput,
} from '../types'

const base = (patientId: string) => `/patients/${patientId}/treatment-plans`

/**
 * Active catalog procedures; prices only for users who may see them — the
 * doctor's own price when `doctorId` is given, as billing will charge it.
 */
export async function fetchServiceCatalog(
  doctorId?: string | null,
): Promise<ServiceOption[]> {
  const { data } = await api.get('/treatments/catalog', {
    params: doctorId ? { doctorId } : undefined,
  })
  return data.data
}

export async function fetchTreatmentPlans(
  patientId: string,
): Promise<TreatmentPlan[]> {
  const { data } = await api.get(base(patientId))
  return data.data
}

export async function createTreatmentPlan(
  patientId: string,
  input: TreatmentPlanInput,
): Promise<TreatmentPlan> {
  const { data } = await api.post(base(patientId), input)
  return data.data
}

export async function updateTreatmentPlan(
  patientId: string,
  planId: string,
  input: Partial<TreatmentPlanInput>,
): Promise<TreatmentPlan> {
  const { data } = await api.patch(`${base(patientId)}/${planId}`, input)
  return data.data
}

export async function setTreatmentPlanDiscount(
  patientId: string,
  planId: string,
  discountKind: DiscountKind | null,
  discountValue: number | null,
): Promise<TreatmentPlan> {
  const { data } = await api.patch(`${base(patientId)}/${planId}/discount`, {
    discountKind,
    discountValue,
  })
  return data.data
}

export async function acceptTreatmentPlan(
  patientId: string,
  planId: string,
): Promise<TreatmentPlan> {
  const { data } = await api.post(`${base(patientId)}/${planId}/accept`)
  return data.data
}

/** One session of a step done (in this visit, when `encounterId` is given). */
export async function recordPlanSession(
  patientId: string,
  planId: string,
  itemId: string,
  encounterId?: string,
): Promise<TreatmentPlan> {
  const { data } = await api.post(
    `${base(patientId)}/${planId}/items/${itemId}/session`,
    { encounterId },
  )
  return data.data
}

export async function cancelTreatmentPlan(
  patientId: string,
  planId: string,
): Promise<TreatmentPlan> {
  const { data } = await api.post(`${base(patientId)}/${planId}/cancel`)
  return data.data
}
