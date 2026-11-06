import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NumberInput } from '@/components/forms/NumberInput'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, FormSection, FormSheet } from '@/components/shared'
import {
  formatMinor,
  minorToRupeesText,
  rupeesToMinor,
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
  priceMinor: number
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
        priceMinor: l.quantity * l.unitPriceMinor,
      }))
    return [
      ...fromDraft,
      ...(billing?.unbilledItems ?? []).map((i) => ({
        id: i.id,
        kind: 'lab_item' as const,
        description: i.description,
        priceMinor: i.patientLinePriceMinor,
      })),
      ...(billing?.unbilledCharges ?? []).map((c) => ({
        id: c.id,
        kind: 'lab_charge' as const,
        description: `Lab charge (${c.kind}): ${c.reason}`,
        priceMinor: c.amountMinor,
      })),
    ]
  }, [billing, draft])

  const pick = (v: InvoiceValues) =>
    options.filter((o) =>
      (o.kind === 'lab_item' ? v.itemIds : v.chargeIds).includes(o.id),
    )

  /** What the line costs the patient: the typed price, else the list price. */
  const priceOf = (o: Option, v: InvoiceValues) => {
    const typed = v.prices[o.id]?.trim()
    return (typed ? rupeesToMinor(typed) : null) ?? o.priceMinor
  }

  const initial: InvoiceValues = draft
    ? {
        itemIds: draft.lines.flatMap((l) =>
          l.labOrderItemId ? [l.labOrderItemId] : [],
        ),
        chargeIds: draft.lines.flatMap((l) =>
          l.chargeRequestId ? [l.chargeRequestId] : [],
        ),
        // Keep what the estimate already charges (it may differ from the list).
        prices: Object.fromEntries(
          draft.lines.flatMap((l) => {
            const id = l.labOrderItemId ?? l.chargeRequestId
            return id
              ? [[id, minorToRupeesText(l.quantity * l.unitPriceMinor)]]
              : []
          }),
        ),
        discount: draft.discountMinor
          ? minorToRupeesText(draft.discountMinor)
          : '',
        taxPercent: String((draft.lines[0]?.taxRateBp ?? 0) / 100),
        notes: draft.notes ?? '',
        issue: false,
      }
    : {
        itemIds: options.filter((o) => o.kind === 'lab_item').map((o) => o.id),
        chargeIds: [],
        prices: {},
        discount: '',
        taxPercent: String((settings.data?.taxRateBp ?? 0) / 100),
        notes: '',
        issue: false,
      }

  const form = useInvoiceForm({
    open,
    initial,
    subtotalOf: (v) => pick(v).reduce((a, o) => a + priceOf(o, v), 0),
    onSubmit: async (v) => {
      await onSave({
        lines: pick(v).map((o) => {
          const typed = v.prices[o.id]?.trim()
          const unitPriceMinor = typed ? (rupeesToMinor(typed) ?? undefined) : undefined
          return o.kind === 'lab_item'
            ? { kind: 'lab_item', itemId: o.id, unitPriceMinor }
            : { kind: 'lab_charge', chargeRequestId: o.id, unitPriceMinor }
        }),
        discountMinor: v.discount.trim() ? (rupeesToMinor(v.discount) ?? 0) : 0,
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
      description="Prices start at the patient prices fixed when the order was submitted; change a line's price to charge this patient differently."
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
                    <form.Field name="prices">
                      {(pricesField) => (
                        <FieldWrapper
                          label="Lines"
                          error={fieldError(itemsField)}
                        >
                          <div className="divide-y divide-border rounded-lg border border-border">
                            {options.map((o) => {
                              const f =
                                o.kind === 'lab_item'
                                  ? itemsField
                                  : chargesField
                              const checked = f.state.value.includes(o.id)
                              return (
                                <div
                                  key={o.id}
                                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) =>
                                      f.handleChange(
                                        c
                                          ? [...f.state.value, o.id]
                                          : f.state.value.filter(
                                              (x) => x !== o.id,
                                            ),
                                      )
                                    }
                                    aria-label={o.description}
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {o.description}
                                  </span>
                                  {checked ? (
                                    <NumberInput
                                      className="h-8 w-28 text-right"
                                      aria-label={`Price for ${o.description}`}
                                      placeholder={minorToRupeesText(
                                        o.priceMinor,
                                      )}
                                      value={pricesField.state.value[o.id] ?? ''}
                                      onChange={(e) =>
                                        pricesField.handleChange({
                                          ...pricesField.state.value,
                                          [o.id]: e.target.value,
                                        })
                                      }
                                    />
                                  ) : (
                                    <span className="tabular-nums">
                                      {formatMinor(o.priceMinor)}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <p className="mt-1 text-xs text-text-3">
                            Leave a price blank to charge the list price, or
                            type another amount for this patient.
                          </p>
                        </FieldWrapper>
                      )}
                    </form.Field>
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
                pick(v).map((o) => priceOf(o, v)),
                rupeesToMinor(v.discount || '0') ?? 0,
                percentToBp(v.taxPercent || '0') ?? 0,
              )
              return (
                <div className="space-y-1 rounded-lg bg-muted/40 p-3">
                  <MoneyRow label="Subtotal" value={p.subtotalMinor} />
                  <MoneyRow label="Discount" value={p.discountMinor} negative />
                  <MoneyRow label="Tax" value={p.taxMinor} />
                  <MoneyRow label="Total" value={p.totalMinor} strong />
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
