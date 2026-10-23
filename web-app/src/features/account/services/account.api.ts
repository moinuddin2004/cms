import api from '@/lib/api'
import type {
  AccountSummary,
  AdminSubscription,
  AdminSubscriptionRow,
  ClinicSetup,
  Plan,
  SubscriptionPayment,
  SubscriptionSummary,
} from '../types'
import type {
  RecordPaymentInput,
  SetupClinicInput,
  SetupLocationInput,
  UpdateSubscriptionInput,
} from '../schemas/account.schema'

async function get<T>(url: string): Promise<T> {
  const { data } = await api.get(url)
  return data.data as T
}
async function send<T>(
  method: 'post' | 'patch' | 'put',
  url: string,
  body?: object,
): Promise<T> {
  const { data } = await api[method](url, body)
  return data.data as T
}

// ── Active clinic ──────────────────────────────────────────────────────
export const fetchAccount = () => get<AccountSummary>('/account')
export const fetchClinicSetup = () => get<ClinicSetup>('/account/setup')
export const saveSetupClinic = (body: SetupClinicInput) =>
  send<ClinicSetup>('patch', '/account/setup/clinic', body)
export const saveSetupLocation = (body: SetupLocationInput) =>
  send<ClinicSetup>('patch', '/account/setup/location', body)
export const completeSetup = () =>
  send<ClinicSetup>('post', '/account/setup/complete')

// ── Email verification ────────────────────────────────────────────────
export const verifyEmail = (token: string) =>
  send<{ message: string }>('post', '/auth/verify-email', { token })
export const resendVerification = () =>
  send<{ message: string }>('post', '/auth/resend-verification')

// ── Super admin ───────────────────────────────────────────────────────
export const fetchAdminSubscriptions = () =>
  get<{ plans: Plan[]; clinics: AdminSubscriptionRow[] }>(
    '/admin/subscriptions',
  )
export const fetchAdminSubscription = (orgId: string) =>
  get<AdminSubscription>(`/admin/subscriptions/${orgId}`)
export const updateAdminSubscription = (
  orgId: string,
  body: UpdateSubscriptionInput,
) => send<SubscriptionSummary>('patch', `/admin/subscriptions/${orgId}`, body)
export const recordSubscriptionPayment = (
  orgId: string,
  body: RecordPaymentInput,
) =>
  send<SubscriptionPayment>(
    'post',
    `/admin/subscriptions/${orgId}/payments`,
    body,
  )
export const fetchPaymentInstructions = () =>
  get<{ text: string }>('/admin/subscriptions/payment-instructions')
export const savePaymentInstructions = (text: string) =>
  send<{ text: string }>('put', '/admin/subscriptions/payment-instructions', {
    text,
  })
