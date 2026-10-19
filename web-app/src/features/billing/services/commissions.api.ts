import api from '@/lib/api'
import type {
  CommissionEntryRow,
  CommissionRuleInput,
  CompensationOverview,
  CompensationPlanInput,
  DoctorEarningsReport,
  MyEarnings,
} from '../types/commission.types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function send<T>(
  method: 'post' | 'put',
  url: string,
  body: unknown,
): Promise<T> {
  const { data } = await api[method](url, body)
  return data.data as T
}

/** Doctor compensation plans + commission reports (feature billing.commissions). */
export const commissionsApi = {
  plans: (assignmentId: string) =>
    get<CompensationOverview>(
      `/assignments/${assignmentId}/compensation-plans`,
    ),
  addPlan: (assignmentId: string, body: CompensationPlanInput) =>
    send<CompensationOverview>(
      'post',
      `/assignments/${assignmentId}/compensation-plans`,
      body,
    ),
  replaceRules: (planId: string, rules: CommissionRuleInput[]) =>
    send<CompensationOverview>('put', `/compensation-plans/${planId}/rules`, {
      rules,
    }),
  entries: (params: {
    assignmentId?: string
    from?: string
    to?: string
    locationId?: string
  }) => get<CommissionEntryRow[]>('/commissions', params),
  doctorEarnings: (params: { from: string; to: string; locationId?: string }) =>
    get<DoctorEarningsReport>('/reports/doctor-earnings', params),
  myEarnings: (params: { from: string; to: string }) =>
    get<MyEarnings>('/me/earnings', params),
}
