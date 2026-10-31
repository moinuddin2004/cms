import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { toInputValue, toNumber, toNumberOrNull } from '@/lib/zod-numbers'
import {
  recordPaymentSchema,
  updateSubscriptionSchema,
} from '../schemas/account.schema'
import type {
  RecordPaymentFormValues,
  UpdateSubscriptionFormValues,
} from '../schemas/account.schema'
import type { AdminSubscription, PlanKey } from '../types'
import {
  useRecordSubscriptionPayment,
  useUpdateAdminSubscription,
} from './useAccount'

/** `yyyy-MM-dd` for a DatePicker from an ISO timestamp. */
export const toYmd = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** A picked day as the end of that day, local time. */
export const endOfDayIso = (ymd: string | null) =>
  ymd ? new Date(`${ymd}T23:59:59`).toISOString() : null

function paymentDefaults(
  sub: AdminSubscription | undefined,
): RecordPaymentFormValues {
  const plan: PlanKey =
    sub && sub.plan.key !== 'free' ? sub.plan.key : 'starter'
  const price = sub?.plans.find((p) => p.key === plan)?.monthlyPrice ?? 0
  return {
    plan,
    months: '1',
    amount: toInputValue(price),
    method: 'bank_transfer',
    reference: '',
    paidAt: toYmd(new Date().toISOString())!,
    notes: '',
  }
}

/** Super admin: record a payment the clinic made outside the app. */
export function useRecordPaymentForm(
  orgId: string | null,
  sub: AdminSubscription | undefined,
  onDone: () => void,
) {
  const record = useRecordSubscriptionPayment(orgId)
  const form = useForm({
    defaultValues: paymentDefaults(sub),
    validators: { onChange: recordPaymentSchema, onSubmit: recordPaymentSchema },
    onSubmit: async ({ value }) => {
      await record.mutateAsync({
        ...value,
        months: toNumber(value.months),
        amount: toNumber(value.amount),
        paidAt: new Date(`${value.paidAt}T12:00:00`).toISOString(),
      })
      form.reset(paymentDefaults(sub))
      onDone()
    },
  })
  useEffect(() => {
    form.reset(paymentDefaults(sub))
  }, [sub?.organization.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return { form, record }
}

function planDefaults(
  sub: AdminSubscription | undefined,
): UpdateSubscriptionFormValues {
  return {
    plan: sub?.plan.key ?? 'starter',
    trialEndsAt: toYmd(sub?.trialEndsAt ?? null),
    paidUntil: toYmd(sub?.paidUntil ?? null),
    maxLocations: toInputValue(sub?.overrides.maxLocations),
    maxUsers: toInputValue(sub?.overrides.maxUsers),
  }
}

/** Super admin: plan, trial / paid-until dates and limit overrides. */
export function useUpdateSubscriptionForm(
  orgId: string | null,
  sub: AdminSubscription | undefined,
  onDone: () => void,
) {
  const update = useUpdateAdminSubscription(orgId)
  const form = useForm({
    defaultValues: planDefaults(sub),
    validators: {
      onChange: updateSubscriptionSchema,
      onSubmit: updateSubscriptionSchema,
    },
    onSubmit: async ({ value }) => {
      await update.mutateAsync({
        ...value,
        maxLocations: toNumberOrNull(value.maxLocations),
        maxUsers: toNumberOrNull(value.maxUsers),
        trialEndsAt: endOfDayIso(value.trialEndsAt),
        paidUntil: endOfDayIso(value.paidUntil),
      })
      onDone()
    },
  })
  useEffect(() => {
    form.reset(planDefaults(sub))
  }, [sub]) // eslint-disable-line react-hooks/exhaustive-deps
  return { form, update }
}
