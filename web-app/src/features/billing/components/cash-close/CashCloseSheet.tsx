import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import {
  useCashClosePreview,
  usePaymentAccounts,
} from '../../hooks/use-billing-queries'
import { reportsApi } from '../../services/billing-v2.api'
import { PrintButton } from '../print/PrintButton'
import { Money } from '../shared/billing-badges'

const isAmount = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim())

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
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [closedId, setClosedId] = useState<string | null>(null)
  const create = useBillingMutation(reportsApi.createCashClose, {
    success: 'Counter closed',
  })

  useEffect(() => {
    if (open) {
      setCounted({})
      setNote('')
      setClosedId(null)
    }
  }, [open])

  const isCounted = (id: string) =>
    accounts.data?.find((a) => a.id === id)?.countedInCashClose ?? false
  const lines = (preview.data?.lines ?? []).map((l) => {
    const raw = counted[l.paymentAccountId] ?? ''
    const needs = isCounted(l.paymentAccountId)
    const variance =
      needs && isAmount(raw)
        ? Math.round((Number(raw) - l.expected) * 100) / 100
        : 0
    return { ...l, raw, needs, variance }
  })
  const missing = lines.some((l) => l.needs && !isAmount(l.raw))
  const hasVariance = lines.some((l) => l.variance !== 0)
  const canSubmit =
    !!preview.data && !missing && (!hasVariance || note.trim().length > 0)

  const submit = () => {
    if (!preview.data || !canSubmit) return
    create.mutate(
      {
        periodEnd: preview.data.periodEnd,
        lines: lines.map((l) => ({
          paymentAccountId: l.paymentAccountId,
          ...(l.needs ? { counted: Number(l.raw) } : {}),
        })),
        note: note.trim() || undefined,
      },
      { onSuccess: (c) => setClosedId(c.id) },
    )
  }

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
            <Button onClick={submit} disabled={!canSubmit || create.isPending}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Close counter ({formatCurrency(
                preview.data?.totalExpected ?? 0,
              )}{' '}
              expected)
            </Button>
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
                  <FieldWrapper
                    label="Counted (Rs)"
                    htmlFor={`count-${l.paymentAccountId}`}
                    required
                    className="flex-1"
                  >
                    <Input
                      id={`count-${l.paymentAccountId}`}
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={l.raw}
                      onChange={(e) =>
                        setCounted((c) => ({
                          ...c,
                          [l.paymentAccountId]: e.target.value,
                        }))
                      }
                    />
                  </FieldWrapper>
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
          <FieldWrapper
            label="Note"
            htmlFor="close-note"
            required={hasVariance}
            error={
              hasVariance && !note.trim() ? 'Explain the difference' : undefined
            }
          >
            <Textarea
              id="close-note"
              dir="auto"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FieldWrapper>
        </div>
      )}
    </FormSheet>
  )
}
