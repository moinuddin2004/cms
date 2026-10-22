import { useEffect, useMemo, useReducer } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { useDebounce } from '@/hooks/useDebounce'
import { useAccess } from '@/features/access'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import {
  useDiscountTypes,
  usePatientCharges,
} from '../../hooks/use-billing-queries'
import { billingError } from '../../lib/billing-errors'
import { DISCOUNT_PERMS } from '../../lib/billing-permissions'
import { invoicesApi } from '../../services/billing-v2.api'
import type { Charge, Invoice, InvoiceEditOp } from '../../types/billing.types'
import { OptionSelect } from '../shared/OptionSelect'
import { Money } from '../shared/billing-badges'
import {
  editInvoiceReducer,
  emptyEditState,
  toOperations,
} from './edit-invoice.reducer'

export interface InvoiceEditRequest {
  expectedRevision: number
  operations: InvoiceEditOp[]
  reason: string
}

const KEEP = '__keep'
const REMOVE = '__remove'

/**
 * Edit an issued invoice (D10, plan §8.3). Every number shown comes from
 * `/edit/preview`; a stale revision (409) shows "changed by someone else"
 * with Reload. "Save & refund" hands the edit to the refund sheet so edit
 * and refund commit together (6.10).
 */
export function EditInvoiceSheet({
  invoice,
  open,
  onOpenChange,
  onSaveAndRefund,
  onReload,
}: {
  invoice: Invoice
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaveAndRefund: (edit: InvoiceEditRequest, releasedToAdvance: number) => void
  onReload: () => void
}) {
  const { can } = useAccess()
  const canOverridePrice = can('billing.price.override')
  const canDiscount = can(DISCOUNT_PERMS)
  const canVoid = can('billing.invoice.void')
  const [state, dispatch] = useReducer(editInvoiceReducer, emptyEditState)
  const discountTypes = useDiscountTypes(true, open)
  const unbilled = usePatientCharges(invoice.patient.id, 'unbilled')
  const charges = useMemo(
    () => (invoice.charges ?? []).filter((c) => c.status === 'ACTIVE'),
    [invoice.charges],
  )

  useEffect(() => {
    if (open) dispatch({ type: 'reset' })
  }, [open])

  const operations = useMemo(
    () => toOperations(state, charges),
    [state, charges],
  )
  const debouncedOps = useDebounce(operations, 300)
  const preview = useQuery({
    queryKey: [
      'billing-preview',
      'invoice-edit',
      invoice.id,
      invoice.revision,
      debouncedOps,
    ],
    queryFn: () =>
      invoicesApi.editPreview(invoice.id, {
        expectedRevision: invoice.revision,
        operations: debouncedOps,
      }),
    enabled: open && debouncedOps.length > 0,
    retry: false,
  })
  const save = useBillingMutation(
    (req: InvoiceEditRequest) => invoicesApi.edit(invoice.id, req),
    { success: (inv) => `Saved — revision ${inv.revision}` },
  )

  const conflict =
    billingError(preview.error ?? save.error).code ===
    'BILLING_INVOICE_REVISION_CONFLICT'
  const reasonOk = state.reason.trim().length >= 5
  const ready =
    operations.length > 0 &&
    debouncedOps === operations &&
    preview.isSuccess &&
    !preview.isFetching &&
    reasonOk
  const request: InvoiceEditRequest = {
    expectedRevision: invoice.revision,
    operations,
    reason: state.reason.trim(),
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      widthClassName="sm:max-w-2xl"
      title={`Edit ${invoice.invoiceNumber}`}
      description={`Revision ${invoice.revision} → ${invoice.revision + 1}. The invoice number never changes.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {ready && preview.data.releasedToAdvance > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                onSaveAndRefund(request, preview.data.releasedToAdvance)
              }
            >
              Save &amp; refund
            </Button>
          )}
          <Button
            disabled={!ready || save.isPending}
            onClick={() =>
              save.mutate(request, { onSuccess: () => onOpenChange(false) })
            }
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {conflict && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg bg-danger-soft p-3 text-sm text-danger"
            role="alert"
          >
            This invoice was changed by someone else.
            <Button size="sm" variant="outline" onClick={onReload}>
              <RotateCcw className="size-4" /> Reload
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {charges.map((c) => (
            <EditRow
              key={c.id}
              charge={c}
              edit={state.edits[c.id] ?? {}}
              canPrice={canOverridePrice || !c.serviceId}
              canDiscount={canDiscount}
              canVoid={canVoid}
              discountOptions={(discountTypes.data ?? []).map((t) => ({
                value: t.id,
                label: t.name,
              }))}
              onChange={(patch) =>
                dispatch({ type: 'edit', chargeId: c.id, patch })
              }
            />
          ))}
        </div>

        {(unbilled.data ?? []).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Add unbilled charges</p>
            {(unbilled.data ?? []).map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={state.addChargeIds.includes(c.id)}
                  onCheckedChange={() =>
                    dispatch({ type: 'toggleAdd', chargeId: c.id })
                  }
                />
                <span dir="auto" className="flex-1">
                  {c.description}
                </span>
                <Money value={c.netAmount} />
              </label>
            ))}
          </div>
        )}

        <FieldWrapper
          label="Reason"
          htmlFor="edit-reason"
          required
          error={
            state.reason && !reasonOk ? 'At least 5 characters' : undefined
          }
        >
          <Textarea
            id="edit-reason"
            dir="auto"
            rows={2}
            value={state.reason}
            onChange={(e) =>
              dispatch({ type: 'reason', value: e.target.value })
            }
          />
        </FieldWrapper>

        {operations.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-border bg-panel p-3 text-sm">
            {preview.isError && !conflict ? (
              <p className="flex items-center gap-2 text-danger">
                <AlertTriangle className="size-4" />
                {billingError(preview.error).message}
              </p>
            ) : !preview.data ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Calculating…
              </p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New total</span>
                  <Money
                    value={preview.data.newTotal}
                    className="font-semibold"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Change</span>
                  <Money value={preview.data.delta} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New balance</span>
                  <Money value={preview.data.newBalanceDue} />
                </div>
                {preview.data.releasedToAdvance > 0 && (
                  <p className="pt-1 text-emerald">
                    <Money value={preview.data.releasedToAdvance} /> will move
                    to the patient&apos;s advance.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </FormSheet>
  )
}

function EditRow({
  charge,
  edit,
  canPrice,
  canDiscount,
  canVoid,
  discountOptions,
  onChange,
}: {
  charge: Charge
  edit: {
    quantity?: number
    unitPrice?: string
    void?: boolean
    discountTypeId?: string | null
  }
  canPrice: boolean
  canDiscount: boolean
  canVoid: boolean
  discountOptions: Array<{ value: string; label: string }>
  onChange: (patch: {
    quantity?: number
    unitPrice?: string
    void?: boolean
    discountTypeId?: string | null
  }) => void
}) {
  const discountValue =
    edit.discountTypeId === null ? REMOVE : (edit.discountTypeId ?? KEEP)
  return (
    <div
      className={`grid grid-cols-[1fr_4rem_6rem_9rem_auto] items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm ${edit.void ? 'opacity-50' : ''}`}
    >
      <div className="min-w-0">
        <div
          dir="auto"
          className={`truncate font-medium ${edit.void ? 'line-through' : ''}`}
        >
          {charge.description}
        </div>
        <div className="text-xs text-muted-foreground">
          Net <Money value={charge.netAmount} /> · paid{' '}
          <Money value={charge.allocatedAmount} />
        </div>
      </div>
      <Input
        aria-label="Quantity"
        type="number"
        min={1}
        className="h-8"
        disabled={edit.void}
        value={edit.quantity ?? charge.quantity}
        onChange={(e) => onChange({ quantity: Number(e.target.value) })}
      />
      <Input
        aria-label="Unit price"
        inputMode="decimal"
        className="h-8 text-right tabular-nums"
        disabled={edit.void || !canPrice}
        value={edit.unitPrice ?? String(charge.unitPrice)}
        onChange={(e) => onChange({ unitPrice: e.target.value })}
      />
      <OptionSelect
        className="h-8 w-full"
        disabled={edit.void || !canDiscount}
        value={discountValue}
        onChange={(v) =>
          onChange({
            discountTypeId: v === KEEP ? undefined : v === REMOVE ? null : v,
          })
        }
        options={[
          {
            value: KEEP,
            label: charge.discount ? charge.discount.name : 'No discount',
          },
          ...(charge.discount
            ? [{ value: REMOVE, label: 'Remove discount' }]
            : []),
          ...discountOptions,
        ]}
      />
      {canVoid ? (
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={!!edit.void}
            onCheckedChange={(v) => onChange({ void: v === true })}
            aria-label={`Void ${charge.description}`}
          />
          Void
        </label>
      ) : (
        <span />
      )}
    </div>
  )
}
