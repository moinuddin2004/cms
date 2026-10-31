import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NumberInput } from '@/components/forms/NumberInput'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, FormSection, FormSheet } from '@/components/shared'
import {
  formatPaisa,
  paisaToRupeesText,
  rupeesToPaisa,
} from '@/features/lab-catalog'
import { fieldError } from '@/features/queue'
import { useInvoiceForm } from '../hooks/useLabBillingForms'
import { useLabBillingSettings } from '../hooks/useLabBilling'
import { previewInvoice } from '../lib/invoice-math'
import { percentToBp } from '../schemas/lab-billing.schema'
import type { InvoiceValues } from '../schemas/lab-billing.schema'
import type { InvoiceInput, LabInvoiceDetail, OrderBilling } from '../types'
import { MoneyRow } from './billing-bits'
import { activeCurrency } from '@/lib/currency'

interface Option {
  id: string
  kind: 'lab_item' | 'lab_charge'
  description: string
  pricePaisa: number
}

/**
 * New estimate / invoice from a lab order's unbilled work — or edit of an
 * existing estimate. Prices are the order's frozen patient prices; the
 * clinic picks the lines, an invoice discount and the tax rate.
 */
export function InvoiceSheet({
  open,
  onOpenChange,
  billing,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  billing: OrderBilling | undefined
  /** Edit this estimate instead of creating one. */
  draft?: LabInvoiceDetail | null
  onSave: (input: InvoiceInput) => Promise<unknown>
}) {
  const settings = useLabBillingSettings()
  const options = useMemo<Option[]>(() => {
    const fromDraft: Option[] = (draft?.lines ?? [])
      .filter((l) => l.kind !== 'manual')
      .map((l) => ({
        id: (l.labOrderItemId ?? l.chargeRequestId) as string,
        kind: l.kind as Option['kind'],
        description: l.description,
        pricePaisa: l.quantity * l.unitPricePaisa,
      }))
    return [
      ...fromDraft,
      ...(billing?.unbilledItems ?? []).map((i) => ({
        id: i.id,
        kind: 'lab_item' as const,
        description: i.description,
        pricePaisa: i.patientLinePricePaisa,
      })),
      ...(billing?.unbilledCharges ?? []).map((c) => ({
        id: c.id,
        kind: 'lab_charge' as const,
        description: `Lab charge (${c.kind}): ${c.reason}`,
        pricePaisa: c.amountPaisa,
      })),
    ]
  }, [billing, draft])

  const pick = (v: InvoiceValues) =>
    options.filter((o) =>
      (o.kind === 'lab_item' ? v.itemIds : v.chargeIds).includes(o.id),
    )

  const initial: InvoiceValues = draft
    ? {
        itemIds: draft.lines.flatMap((l) =>
          l.labOrderItemId ? [l.labOrderItemId] : [],
        ),
        chargeIds: draft.lines.flatMap((l) =>
          l.chargeRequestId ? [l.chargeRequestId] : [],
        ),
        discount: draft.discountPaisa
          ? paisaToRupeesText(draft.discountPaisa)
          : '',
        taxPercent: String((draft.lines[0]?.taxRateBp ?? 0) / 100),
        notes: draft.notes ?? '',
        issue: false,
      }
    : {
        itemIds: options.filter((o) => o.kind === 'lab_item').map((o) => o.id),
        chargeIds: [],
        discount: '',
        taxPercent: String((settings.data?.taxRateBp ?? 0) / 100),
        notes: '',
        issue: false,
      }

  const form = useInvoiceForm({
    open,
    initial,
    subtotalOf: (v) => pick(v).reduce((a, o) => a + o.pricePaisa, 0),
    onSubmit: async (v) => {
      await onSave({
        lines: pick(v).map((o) =>
          o.kind === 'lab_item'
            ? { kind: 'lab_item', itemId: o.id }
            : { kind: 'lab_charge', chargeRequestId: o.id },
        ),
        discountPaisa: v.discount.trim() ? (rupeesToPaisa(v.discount) ?? 0) : 0,
        taxRateBp: percentToBp(v.taxPercent || '0') ?? 0,
        notes: v.notes.trim() || undefined,
        issue: v.issue,
      })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={draft ? 'Edit estimate' : 'Bill lab work'}
      description="Prices are the patient prices fixed when the order was submitted."
      widthClassName="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) =>
              [s.canSubmit, s.isSubmitting, s.values.issue] as const
            }
          >
            {([canSubmit, isSubmitting, issue]) => (
              <Button
                disabled={!canSubmit || isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {issue ? 'Issue invoice' : 'Save estimate'}
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FormSection title="What to bill">
          {options.length === 0 ? (
            <p className="text-sm text-text-3">
              Everything on this order is billed.
            </p>
          ) : (
            <form.Field name="itemIds">
              {(itemsField) => (
                <form.Field name="chargeIds">
                  {(chargesField) => (
                    <FieldWrapper label="Lines" error={fieldError(itemsField)}>
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {options.map((o) => {
                          const f =
                            o.kind === 'lab_item' ? itemsField : chargesField
                          const checked = f.state.value.includes(o.id)
                          return (
                            <label
                              key={o.id}
                              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) =>
                                  f.handleChange(
                                    c
                                      ? [...f.state.value, o.id]
                                      : f.state.value.filter((x) => x !== o.id),
                                  )
                                }
                                aria-label={o.description}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {o.description}
                              </span>
                              <span className="tabular-nums">
                                {formatPaisa(o.pricePaisa)}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </FieldWrapper>
                  )}
                </form.Field>
              )}
            </form.Field>
          )}
        </FormSection>

        <FormSection title="Discount and tax">
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="discount">
              {(f) => (
                <FieldWrapper
                  label={`Discount (${activeCurrency()})`}
                  htmlFor="inv-discount"
                  error={fieldError(f)}
                >
                  <NumberInput
                    id="inv-discount"
                    placeholder="0"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="taxPercent">
              {(f) => (
                <FieldWrapper
                  label="Tax (%)"
                  htmlFor="inv-tax"
                  error={fieldError(f)}
                >
                  <NumberInput
                    id="inv-tax"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>
          <form.Subscribe selector={(s) => s.values}>
            {(v) => {
              const p = previewInvoice(
                pick(v).map((o) => o.pricePaisa),
                rupeesToPaisa(v.discount || '0') ?? 0,
                percentToBp(v.taxPercent || '0') ?? 0,
              )
              return (
                <div className="space-y-1 rounded-lg bg-muted/40 p-3">
                  <MoneyRow label="Subtotal" value={p.subtotalPaisa} />
                  <MoneyRow label="Discount" value={p.discountPaisa} negative />
                  <MoneyRow label="Tax" value={p.taxPaisa} />
                  <MoneyRow label="Total" value={p.totalPaisa} strong />
                </div>
              )
            }}
          </form.Subscribe>
        </FormSection>

        <form.Field name="notes">
          {(f) => (
            <FieldWrapper
              label="Notes"
              htmlFor="inv-notes"
              error={fieldError(f)}
            >
              <Textarea
                id="inv-notes"
                rows={2}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>

        <form.Field name="issue">
          {(f) => (
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Switch
                checked={f.state.value}
                onCheckedChange={(c) => f.handleChange(c)}
                aria-label="Issue now"
              />
              <span className="text-sm">
                <span className="font-medium">Issue now</span>
                <span className="block text-text-3">
                  Gives it an invoice number and uses the patient’s advance.
                  Leave off to save an estimate you can still change.
                </span>
              </span>
            </label>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
