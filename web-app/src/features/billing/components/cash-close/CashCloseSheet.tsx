import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/forms/NumberInput'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  useCashClosePreview,
  usePaymentAccounts,
} from '../../hooks/use-billing-queries'
import { useCashCloseForm } from '../../hooks/useCashCloseForm'
import { cashVariance } from '../../schemas/cash-close.schema'
import { PrintButton } from '../print/PrintButton'
import { Money } from '../shared/billing-badges'

/**
 * Close the counter (D23, plan §8.3): expected per account since the last
 * close, a count for counted accounts (cash), live variance, and a note
 * whenever anything differs. The server recomputes everything.
 */
export function CashCloseSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const preview = useCashClosePreview(open)
  const accounts = usePaymentAccounts()
  const [closedId, setClosedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) setClosedId(null)
  }, [open])

  const checks = useMemo(
    () =>
      (preview.data?.lines ?? []).map((l) => ({
        paymentAccountId: l.paymentAccountId,
        expected: l.expected,
        needs:
          accounts.data?.find((a) => a.id === l.paymentAccountId)
            ?.countedInCashClose ?? false,
      })),
    [preview.data, accounts.data],
  )
  const form = useCashCloseForm({
    open,
    periodEnd: preview.data?.periodEnd,
    checks,
    onClosed: setClosedId,
  })

  // Live variance preview from what's typed so far.
  const counted = useStore(form.store, (s) => s.values.counted)
  const note = useStore(form.store, (s) => s.values.note)
  const lines = (preview.data?.lines ?? []).map((l, i) => {
    const check = checks[i]
    return {
      ...l,
      needs: check.needs,
      variance: cashVariance(check, counted[l.paymentAccountId]),
    }
  })
  const hasVariance = lines.some((l) => l.variance !== 0)

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Close counter"
      description={
        preview.data?.periodStart
          ? `Since ${new Date(preview.data.periodStart).toLocaleString()}`
          : 'Since the first payment at this location'
      }
      footer={
        closedId ? (
          <>
            <PrintButton
              documentType="cash-close"
              id={closedId}
              label="Print slip"
            />
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  onClick={() => void form.handleSubmit()}
                  disabled={!preview.data || !canSubmit || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Close counter (
                  {formatCurrency(preview.data?.totalExpected ?? 0)} expected)
                </Button>
              )}
            </form.Subscribe>
          </>
        )
      }
    >
      {closedId ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Counter closed. Print the slip to hand over the cash.
        </p>
      ) : preview.isLoading ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : preview.isError ? (
        <ErrorState onRetry={() => void preview.refetch()} />
      ) : (
        <div className="space-y-4">
          {lines.map((l) => (
            <div
              key={l.paymentAccountId}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex items-center justify-between font-medium">
                <span>{l.paymentAccountName}</span>
                <span>
                  Expected{' '}
                  <Money value={l.expected} className="font-semibold" />
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {l.paymentCount} payment(s) <Money value={l.paymentsTotal} /> ·{' '}
                {l.refundCount} refund(s) <Money value={l.refundsTotal} />
              </div>
              {l.needs && (
                <div className="mt-2 flex items-end gap-3">
                  <form.Field name={`counted.${l.paymentAccountId}`}>
                    {(field) => (
                      <FieldWrapper
                        label="Counted (Rs)"
                        htmlFor={`count-${l.paymentAccountId}`}
                        required
                        className="flex-1"
                        error={fieldError(field)}
                      >
                        <NumberInput
                          id={`count-${l.paymentAccountId}`}
                          className="text-right"
                          value={field.state.value ?? ''}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </FieldWrapper>
                    )}
                  </form.Field>
                  <span
                    className={cn(
                      'pb-2 font-semibold',
                      l.variance < 0
                        ? 'text-danger'
                        : l.variance > 0
                          ? 'text-emerald'
                          : 'text-muted-foreground',
                    )}
                  >
                    {l.variance > 0 ? '+' : ''}
                    {formatCurrency(l.variance)}
                  </span>
                </div>
              )}
            </div>
          ))}
          <form.Field name="note">
            {(field) => (
              <FieldWrapper
                label="Note"
                htmlFor="close-note"
                required={hasVariance}
                // The "explain" prompt shows live as soon as a count differs.
                error={
                  fieldError(field) ??
                  (hasVariance && !note.trim()
                    ? 'Explain the difference'
                    : undefined)
                }
              >
                <Textarea
                  id="close-note"
                  dir="auto"
                  rows={2}
                  maxLength={500}
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
  )
}
