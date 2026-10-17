import { useEffect, useMemo, useReducer } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSheet } from '@/components/forms/FormSheet'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency } from '@/lib/formatters'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import {
  useBillingSettings,
  useOpenCharges,
  usePatientBillingSummary,
  usePaymentAccounts,
} from '../../hooks/use-billing-queries'
import { billingError } from '../../lib/billing-errors'
import { paymentsApi } from '../../services/billing-v2.api'
import type {
  CollectPaymentInput,
  PatientRef,
  PaymentPreviewInput,
} from '../../types/billing.types'
import { BillingSummaryCards } from '../shared/BillingSummaryCards'
import { CollectContext } from './collect-context'
import type { CollectContextValue } from './collect-context'
import {
  collectReducer,
  initialCollectState,
  parseAmount,
} from './collect-payment.reducer'
import { CollectCharges } from './CollectCharges'
import { CollectPaymentFields } from './CollectPaymentFields'
import { CollectSuccess } from './CollectSuccess'
import { CollectSummary } from './CollectSummary'

/**
 * Collect a payment — the core reception screen (plan §8.2). Opened from
 * the billing desk, patient tab, queue and invoice detail. Totals come from
 * the debounced `/payments/preview`; Confirm is disabled while it is
 * pending or failing. One `clientRequestId` per open sheet makes
 * double-clicks harmless.
 */
export function CollectPaymentSheet({
  patient,
  open,
  onOpenChange,
  preselectChargeIds,
}: {
  patient: Pick<PatientRef, 'id' | 'name'> & Partial<PatientRef>
  open: boolean
  onOpenChange: (open: boolean) => void
  preselectChargeIds?: string[]
}) {
  const [state, dispatch] = useReducer(
    collectReducer,
    undefined,
    initialCollectState,
  )
  const charges = useOpenCharges(open ? patient.id : undefined)
  const summary = usePatientBillingSummary(open ? patient.id : undefined)
  const accounts = usePaymentAccounts(true)
  const settings = useBillingSettings()
  const defaultAccount =
    settings.data?.defaultPaymentAccountId ?? accounts.data?.[0]?.id ?? ''

  // Fresh state every time the sheet opens with loaded charges.
  const loaded = open && charges.isSuccess && accounts.isSuccess
  useEffect(() => {
    if (loaded)
      dispatch({
        type: 'init',
        charges: charges.data,
        preselect: preselectChargeIds,
        accountId: defaultAccount,
      })
  }, [loaded])
  useEffect(() => {
    if (loaded && !state.result)
      dispatch({ type: 'syncCharges', charges: charges.data })
  }, [charges.data])

  const previewInput = useMemo<PaymentPreviewInput | null>(() => {
    const amount = parseAmount(state.amount)
    if (amount === null) return null
    return {
      patientId: patient.id,
      amount,
      applyAdvance: state.applyAdvance,
      mode: state.mode,
      selections: state.selected.map((chargeId) => ({
        chargeId,
        ...(state.mode === 'MANUAL'
          ? { amount: parseAmount(state.manual[chargeId] ?? '') ?? 0 }
          : {}),
      })),
    }
  }, [
    patient.id,
    state.amount,
    state.applyAdvance,
    state.mode,
    state.selected,
    state.manual,
  ])
  const debounced = useDebounce(previewInput, 300)
  const preview = useQuery({
    queryKey: ['billing-preview', debounced],
    queryFn: () => paymentsApi.preview(debounced as PaymentPreviewInput),
    enabled: open && loaded && !!debounced && !state.result,
    retry: false,
  })
  useEffect(() => {
    if (preview.data)
      dispatch({
        type: 'suggestAmount',
        amount: preview.data.amountToClearSelected,
      })
  }, [preview.data])

  const collect = useBillingMutation((input: CollectPaymentInput) =>
    paymentsApi.collect(input),
  )
  const applyAdvance = useBillingMutation(() =>
    paymentsApi.applyAdvance(patient.id, {
      mode: previewInput?.mode ?? 'AUTO',
      selections: previewInput?.selections ?? [],
    }),
  )

  const amount = parseAmount(state.amount) ?? 0
  const advanceOnly = amount === 0 && (preview.data?.advanceUsed ?? 0) > 0
  const account = accounts.data?.find((a) => a.id === state.accountId)
  const blocked =
    !preview.data ||
    preview.isFetching ||
    preview.isError ||
    debounced !== previewInput ||
    preview.data.blockers.length > 0 ||
    (!advanceOnly && (amount <= 0 || !account)) ||
    (!!account?.requiresReference && !state.reference.trim())
  const pending = collect.isPending || applyAdvance.isPending

  const confirm = async () => {
    if (blocked || !previewInput) return
    const result = advanceOnly
      ? await applyAdvance.mutateAsync(undefined)
      : await collect.mutateAsync({
          ...previewInput,
          paymentAccountId: state.accountId,
          referenceNumber: state.reference.trim() || undefined,
          notes: state.notes.trim() || undefined,
          clientRequestId: state.clientRequestId,
        })
    dispatch({ type: 'success', result })
  }

  const ctx: CollectContextValue = {
    patientId: patient.id,
    state,
    dispatch,
    charges: charges.data ?? [],
    chargesLoading: charges.isLoading,
    accounts: accounts.data ?? [],
    summary: summary.data,
    preview: preview.data,
    previewPending: preview.isFetching || debounced !== previewInput,
    previewError: preview.isError ? billingError(preview.error).message : null,
  }

  return (
    <CollectContext.Provider value={ctx}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        widthClassName="sm:max-w-2xl"
        title={`Collect payment — ${patient.name}`}
        description={
          [patient.mrn, patient.phone].filter(Boolean).join(' · ') || undefined
        }
        footer={
          state.result ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void confirm()}
                disabled={blocked || pending}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {advanceOnly
                  ? `Apply advance ${formatCurrency(preview.data?.advanceUsed ?? 0)}`
                  : `Receive ${formatCurrency(amount)}`}
              </Button>
            </>
          )
        }
      >
        {state.result ? (
          <CollectSuccess result={state.result} />
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              void confirm()
            }}
          >
            <BillingSummaryCards
              summary={summary.data}
              isLoading={summary.isLoading}
              compact
            />
            <CollectCharges />
            <CollectPaymentFields />
            <CollectSummary />
            <button type="submit" hidden aria-hidden />
          </form>
        )}
      </FormSheet>
    </CollectContext.Provider>
  )
}
