import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { fieldError } from '@/features/queue/utils/fieldError'
import { formatCurrency } from '@/lib/formatters'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import { usePaymentAccounts } from '../../hooks/use-billing-queries'
import { newClientRequestId } from '../../lib/billing-errors'
import { refundSchema, toAmount } from '../../schemas/billing.schema'
import type { RefundValues } from '../../schemas/billing.schema'
import { invoicesApi, paymentsApi } from '../../services/billing-v2.api'
import type { InvoiceEditOp, PatientRef } from '../../types/billing.types'
import { OptionSelect } from '../shared/OptionSelect'
import { PrintButton } from '../print/PrintButton'

export type RefundTarget =
  | { kind: 'advance'; patient: Pick<PatientRef, 'id' | 'name'>; max: number }
  | {
      kind: 'invoice'
      patient: Pick<PatientRef, 'id' | 'name'>
      invoiceId: string
      /** Refundable after `edit` (server re-checks). */
      max: number
      edit?: {
        expectedRevision: number
        operations: InvoiceEditOp[]
        reason: string
      }
    }

/**
 * Refund from advance, or against an invoice after an optional edit, in
 * one server transaction (D14, plan §8.3). Always confirms with a sentence
 * naming the amount, method and patient.
 */
export function RefundSheet({
  target,
  open,
  onOpenChange,
}: {
  target: RefundTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accounts = usePaymentAccounts(true)
  const [clientRequestId, setClientRequestId] = useState(newClientRequestId)
  const [confirming, setConfirming] = useState<RefundValues | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const refund = useBillingMutation(
    (v: RefundValues) => {
      const t = target as RefundTarget
      const body = {
        amount: toAmount(v.amount),
        paymentAccountId: v.paymentAccountId,
        referenceNumber: v.referenceNumber.trim() || undefined,
        reason: v.reason.trim(),
        clientRequestId,
      }
      return t.kind === 'advance'
        ? paymentsApi.refundAdvance({ ...body, patientId: t.patient.id })
        : invoicesApi.refund(t.invoiceId, { edit: t.edit, refund: body })
    },
    { success: (r) => `Refund ${r.refundNumber} recorded` },
  )

  const form = useForm({
    defaultValues: {
      amount: '',
      paymentAccountId: '',
      referenceNumber: '',
      reason: '',
    } as RefundValues,
    validators: { onChange: refundSchema, onSubmit: refundSchema },
    onSubmit: ({ value }) => setConfirming(value),
  })

  useEffect(() => {
    if (!open || !target) return
    form.reset({
      amount: target.max > 0 ? String(target.max) : '',
      paymentAccountId: accounts.data?.[0]?.id ?? '',
      referenceNumber: '',
      reason: target.kind === 'invoice' ? (target.edit?.reason ?? '') : '',
    })
    setClientRequestId(newClientRequestId())
    setDoneId(null)
  }, [open])

  if (!target) return null
  const account = (id: string) => accounts.data?.find((a) => a.id === id)

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        widthClassName="sm:max-w-md"
        title={
          target.kind === 'advance' ? 'Refund advance' : 'Refund from invoice'
        }
        description={`${target.patient.name} · up to ${formatCurrency(target.max)}`}
        footer={
          doneId ? (
            <>
              <PrintButton
                documentType="refund"
                id={doneId}
                label="Print voucher"
              />
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <form.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting] as const}
              >
                {([canSubmit]) => (
                  <Button
                    variant="destructive"
                    onClick={() => void form.handleSubmit()}
                    disabled={!canSubmit || refund.isPending}
                  >
                    Refund…
                  </Button>
                )}
              </form.Subscribe>
            </>
          )
        }
      >
        {doneId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Refund recorded. Print the voucher for the patient to sign.
          </p>
        ) : (
          <div className="space-y-4">
            <form.Field name="amount">
              {(field) => (
                <FieldWrapper
                  label="Amount (Rs)"
                  htmlFor="refund-amount"
                  required
                  error={fieldError(field)}
                >
                  <Input
                    id="refund-amount"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="paymentAccountId">
              {(field) => (
                <FieldWrapper
                  label="Paid out from"
                  required
                  error={fieldError(field)}
                >
                  <OptionSelect
                    options={(accounts.data ?? []).map((a) => ({
                      value: a.id,
                      label: a.name,
                    }))}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Subscribe selector={(s) => s.values.paymentAccountId}>
              {(id) =>
                account(id)?.requiresReference ? (
                  <form.Field name="referenceNumber">
                    {(field) => (
                      <FieldWrapper
                        label="Reference number"
                        htmlFor="refund-ref"
                        required
                      >
                        <Input
                          id="refund-ref"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </FieldWrapper>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>
            <form.Field name="reason">
              {(field) => (
                <FieldWrapper
                  label="Reason"
                  htmlFor="refund-reason"
                  required
                  error={fieldError(field)}
                >
                  <Textarea
                    id="refund-reason"
                    dir="auto"
                    rows={3}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>
        )}
      </FormSheet>
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Confirm refund"
        description={
          confirming
            ? `Return ${formatCurrency(toAmount(confirming.amount))} via ${account(confirming.paymentAccountId)?.name ?? '—'} to ${target.patient.name}?`
            : ''
        }
        confirmLabel="Refund"
        destructive
        isLoading={refund.isPending}
        onConfirm={() => {
          if (!confirming) return
          refund.mutate(confirming, {
            onSuccess: (r) => {
              setDoneId(r.id)
              setConfirming(null)
            },
          })
        }}
      />
    </>
  )
}
