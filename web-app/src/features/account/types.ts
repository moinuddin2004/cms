export type PlanKey = 'free' | 'starter' | 'professional' | 'enterprise'

export interface Plan {
  key: PlanKey
  name: string
  /** Monthly price in PKR; null = priced per clinic. */
  monthlyPrice: number | null
  maxLocations: number | null
  maxUsers: number | null
  description: string
}

export type SubscriptionStatus =
  | 'unmanaged'
  | 'trialing'
  | 'active'
  | 'grace'
  | 'expired'

export interface SubscriptionState {
  status: SubscriptionStatus
  periodEndsAt: string | null
  readOnlyFrom: string | null
  daysLeft: number | null
  readOnly: boolean
}

export interface PlanLimits {
  maxLocations: number | null
  maxUsers: number | null
}

export type PaymentMethod =
  | 'bank_transfer'
  | 'jazzcash'
  | 'easypaisa'
  | 'cash'
  | 'cheque'
  | 'other'

export interface SubscriptionPayment {
  id: string
  plan: PlanKey
  months: number
  amount: string
  method: PaymentMethod
  reference: string | null
  paidAt: string
  periodStart: string
  periodEnd: string
  notes: string | null
  createdAt: string
}

export interface SubscriptionSummary {
  organization: { id: string; name: string; isActive: boolean }
  plan: Plan
  trialEndsAt: string | null
  paidUntil: string | null
  state: SubscriptionState
  limits: PlanLimits
  overrides: PlanLimits
  usage: { locations: number; users: number }
}

/** `GET /account` — the active clinic's own view. */
export interface AccountSummary extends SubscriptionSummary {
  isOwner: boolean
  onboardingPending: boolean
  plans: Plan[]
  paymentInstructions: string | null
  payments: SubscriptionPayment[]
}

/** `GET /admin/subscriptions/:orgId`. */
export interface AdminSubscription extends SubscriptionSummary {
  plans: Plan[]
  payments: SubscriptionPayment[]
}

export interface AdminSubscriptionRow {
  organization: { id: string; name: string; isActive: boolean }
  plan: Plan
  trialEndsAt: string | null
  paidUntil: string | null
  state: SubscriptionState
  createdAt: string
}

export interface ClinicSetup {
  clinic: {
    id: string
    name: string
    phone: string | null
    email: string | null
    website: string | null
    specialtyTags: string[]
    timezone: string
    currency: string
  }
  location: {
    id: string
    name: string
    address: string | null
    city: string | null
    phone: string | null
    email: string | null
    taxRate: number
  } | null
  onboardingPending: boolean
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  unmanaged: 'No plan',
  trialing: 'Free trial',
  active: 'Active',
  grace: 'Payment due',
  expired: 'Expired',
}

export const STATUS_TONE: Record<
  SubscriptionStatus,
  'success' | 'warning' | 'danger' | 'info' | 'muted'
> = {
  unmanaged: 'muted',
  trialing: 'info',
  active: 'success',
  grace: 'warning',
  expired: 'danger',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
}

export const SPECIALTY_OPTIONS: { value: string; label: string }[] = [
  { value: 'general', label: 'General practice' },
  { value: 'dental', label: 'Dental' },
  { value: 'skin', label: 'Skin / dermatology' },
  { value: 'ortho', label: 'Orthopaedics' },
  { value: 'physio', label: 'Physiotherapy' },
  { value: 'eye', label: 'Eye care' },
]
