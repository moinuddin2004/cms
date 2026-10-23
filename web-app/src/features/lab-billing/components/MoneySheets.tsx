import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import {
  formatPaisa,
  paisaToRupeesText,
  rupeesToPaisa,
} from '@/features/lab-catalog'
import { fieldError } from '@/features/queue'
import {
  useCreditNoteForm,
  usePaymentForm,
  useRefundForm,
} from '../hooks/useLabBillingForms'
import { newIdempotencyKey } from '../services/lab-billing.api'
import type { PaymentValues, RefundValues } from '../schemas/lab-billing.schema'
import { METHOD_LABEL } from '../types'
import type { LabPaymentMethod, PaymentInput, PatientRef } from '../types'
import { activeCurrency } from '@/lib/currency'

const METHODS = (Object.keys(METHOD_LABEL) as LabPaymentMethod[]).map(
  (value) => ({
    value,
    label: METHOD_LABEL[value],
  }),
)

/**
 * One Idempotency-Key per opening of a sheet: a double click or a retry
 * after a timeout sends the same key, so the server records it once.
 */
function useActionKey(open: boolean) {
  const key = useRef(newIdempotencyKey())
  const wasOpen = useRef(open)
  if (open && !wasOpen.current) key.current = newIdempotencyKey()
  wasOpen.current = open
  return key.current
}

function AmountField({
  field,
  id,
  label,
  hint,
}: {
  field: {
    state: { value: string }
    handleChange: (v: string) => void
    handleBlur: () => void
  } & Parameters<typeof fieldError>[0]
  id: string
  label: string
  hint?: string
}) {
  return (
    <FieldWrapper
      label={label}
      htmlFor={id}
      required
      error={fieldError(field)}
      hint={hint}
    >
      <Input
        id={id}
        inputMode="decimal"
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
    </FieldWrapper>
  )
}

/** Collect a payment from a patient: on one invoice, oldest invoices first, or as advance. */
export function CollectPaymentSheet({
  open,
  onOpenChange,
  patient,
  invoice,
  onCollect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientRef
  invoice?: {
    id: string
    invoiceNo: string | null
    balancePaisa: number
  } | null
  onCollect: (body: PaymentInput, key: string) => Promise<unknown>
}) {
  const key = useActionKey(open)
  const initial: PaymentValues = {
    amount: invoice?.balancePaisa
      ? paisaToRupeesText(invoice.balancePaisa)
      : '',
    method: 'cash',
    reference: '',
    notes: '',
    target: invoice ? 'invoice' : 'auto',
  }
  const form = usePaymentForm({
    open,
    initial,
    onSubmit: async (v) => {
      const amountPaisa = rupeesToPaisa(v.amount) ?? 0
      await onCollect(
        {
          patientId: patient.id,
          amountPaisa,
          method: v.method,
          reference: v.reference.trim() || undefined,
          notes: v.notes.trim() || undefined,
          ...(v.target === 'invoice' && invoice
            ? {
                allocations: [
                  {
                    invoiceId: invoice.id,
                    amountPaisa: Math.min(amountPaisa, invoice.balancePaisa),
                  },
                ],
              }
            : { autoAllocate: v.target === 'auto' }),
        },
        key,
      )
      onOpenChange(false)
    },
  })
  const targets = [
    ...(invoice
      ? [
          {
            value: 'invoice',
            label: `This invoice (${invoice.invoiceNo ?? ''})`,
          },
        ]
      : []),
    { value: 'auto', label: 'Oldest unpaid invoices first' },
    { value: 'advance', label: 'Keep as advance' },
  ]
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Collect payment"
      description={`${patient.fullName} · ${patient.patientNumber}`}
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                disabled={!canSubmit || isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Collect
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="amount">
          {(f) => (
            <AmountField
              field={f}
              id="pay-amount"
              label={`Amount (${activeCurrency()})`}
              hint={
                invoice
                  ? `Balance ${formatPaisa(invoice.balancePaisa)}`
                  : undefined
              }
            />
          )}
        </form.Field>
        <form.Field name="method">
          {(f) => (
            <FormSelect
              label="Method"
              required
              value={f.state.value}
              onValueChange={(v) => f.handleChange(v as LabPaymentMethod)}
              options={METHODS}
            />
          )}
        </form.Field>
        <form.Field name="reference">
          {(f) => (
            <FieldWrapper
              label="Reference"
              htmlFor="pay-ref"
              error={fieldError(f)}
              hint="Card slip or transfer id"
            >
              <Input
                id="pay-ref"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="target">
          {(f) => (
            <FormSelect
              label="Put it on"
              value={f.state.value}
              onValueChange={(v) =>
                f.handleChange(v as PaymentValues['target'])
              }
              options={targets}
            />
          )}
        </form.Field>
        <form.Subscribe
          selector={(s) => [s.values.amount, s.values.target] as const}
        >
          {([amount, target]) => {
            const paisa = rupeesToPaisa(amount) ?? 0
            if (
              target !== 'invoice' ||
              !invoice ||
              paisa <= invoice.balancePaisa
            )
              return null
            return (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-text-3">
                {formatPaisa(invoice.balancePaisa)} settles this invoice;{' '}
                {formatPaisa(paisa - invoice.balancePaisa)} stays as the
                patient’s advance.
              </p>
            )
          }}
        </form.Subscribe>
        <form.Field name="notes">
          {(f) => (
            <FieldWrapper
              label="Notes"
              htmlFor="pay-notes"
              error={fieldError(f)}
            >
              <Textarea
                id="pay-notes"
                rows={2}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}

/** Lower an issued invoice; paid money above the new total goes back to advance. */
export function CreditNoteSheet({
  open,
  onOpenChange,
  invoice,
  onIssue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: {
    invoiceNo: string | null
    totalPaisa: number
    creditedPaisa: number
    balancePaisa: number
  }
  onIssue: (
    body: { amountPaisa: number; reason: string },
    key: string,
  ) => Promise<unknown>
}) {
  const key = useActionKey(open)
  const maxPaisa = invoice.totalPaisa - invoice.creditedPaisa
  const form = useCreditNoteForm({
    open,
    maxPaisa,
    onSubmit: async (v) => {
      await onIssue(
        { amountPaisa: rupeesToPaisa(v.amount) ?? 0, reason: v.reason.trim() },
        key,
      )
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Credit note"
      description={`${invoice.invoiceNo ?? ''} — up to ${formatPaisa(maxPaisa)} can be credited.`}
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                disabled={!canSubmit || isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Issue credit note
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="amount">
          {(f) => <AmountField field={f} id="cn-amount" label={`Amount (${activeCurrency()})`} />}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.amount}>
          {(amount) => {
            const back = Math.max(
              0,
              (rupeesToPaisa(amount) ?? 0) - invoice.balancePaisa,
            )
            return back > 0 ? (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-text-3">
                {formatPaisa(back)} was already paid and goes back to the
                patient’s advance — refund it or use it on another invoice.
              </p>
            ) : null
          }}
        </form.Subscribe>
        <form.Field name="reason">
          {(f) => (
            <FieldWrapper
              label="Reason"
              htmlFor="cn-reason"
              required
              error={fieldError(f)}
            >
              <Textarea
                id="cn-reason"
                rows={3}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}

/** Pay a patient's advance back (optionally as a credit note's payout); confirmed first. */
export function RefundSheet({
  open,
  onOpenChange,
  patient,
  maxPaisa,
  creditNote,
  onRefund,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: PatientRef
  maxPaisa: number
  creditNote?: { id: string; creditNoteNo: string } | null
  onRefund: (
    body: {
      patientId: string
      amountPaisa: number
      method: string
      reference?: string
      reason: string
      creditNoteId?: string
    },
    key: string,
  ) => Promise<unknown>
}) {
  const key = useActionKey(open)
  const [confirm, setConfirm] = useState<RefundValues | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useRefundForm({
    open,
    maxPaisa,
    initialAmount: maxPaisa > 0 ? paisaToRupeesText(maxPaisa) : '',
    onSubmit: async (v) => {
      setConfirm(v)
    },
  })
  const pay = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      await onRefund(
        {
          patientId: patient.id,
          amountPaisa: rupeesToPaisa(confirm.amount) ?? 0,
          method: confirm.method,
          reference: confirm.reference.trim() || undefined,
          reason: confirm.reason.trim(),
          creditNoteId: creditNote?.id,
        },
        key,
      )
      setConfirm(null)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={(o) => !busy && onOpenChange(o)}
        title={
          creditNote ? `Refund ${creditNote.creditNoteNo}` : 'Refund advance'
        }
        description={`${patient.fullName} — up to ${formatPaisa(maxPaisa)} can be paid back.`}
        widthClassName="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <form.Subscribe selector={(s) => s.canSubmit}>
              {(canSubmit) => (
                <Button
                  variant="destructive"
                  disabled={!canSubmit || busy}
                  onClick={() => void form.handleSubmit()}
                >
                  Refund
                </Button>
              )}
            </form.Subscribe>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="amount">
            {(f) => (
              <AmountField field={f} id="rf-amount" label={`Amount (${activeCurrency()})`} />
            )}
          </form.Field>
          <form.Field name="method">
            {(f) => (
              <FormSelect
                label="Paid back by"
                required
                value={f.state.value}
                onValueChange={(v) => f.handleChange(v as LabPaymentMethod)}
                options={METHODS}
              />
            )}
          </form.Field>
          <form.Field name="reference">
            {(f) => (
              <FieldWrapper
                label="Reference"
                htmlFor="rf-ref"
                error={fieldError(f)}
              >
                <Input
                  id="rf-ref"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="reason">
            {(f) => (
              <FieldWrapper
                label="Reason"
                htmlFor="rf-reason"
                required
                error={fieldError(f)}
              >
                <Textarea
                  id="rf-reason"
                  rows={3}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </form>
      </FormSheet>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !busy && !o && setConfirm(null)}
        title="Pay this refund?"
        description={`${formatPaisa(rupeesToPaisa(confirm?.amount ?? '0') ?? 0)} goes back to ${patient.fullName}. A refund can’t be undone.`}
        confirmLabel="Pay refund"
        destructive
        isLoading={busy}
        onConfirm={() => void pay()}
      />
    </>
  )
}
