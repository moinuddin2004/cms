import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { NumberInput } from '@/components/forms/NumberInput'
import {
  FieldWrapper,
  FormInput,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { formatMinor, rupeesToMinor } from '@/features/lab-catalog'
import { fieldError } from '@/features/queue'
import { activeCurrency } from '@/lib/currency'
import {
  useAllocateForm,
  useBillLineForm,
  useEditBillForm,
} from '../hooks/usePayablesForms'
import type {
  AllocateValues,
  BillLineValues,
  EditBillValues,
} from '../schemas/lab-payables.schema'
import { LINE_KIND_LABEL } from '../types'
import type { BillLineKind, VendorBill, VendorPayment } from '../types'

const KINDS = (Object.keys(LINE_KIND_LABEL) as BillLineKind[]).map((value) => ({
  value,
  label: LINE_KIND_LABEL[value],
}))

/** Edit a draft bill's header: the lab's invoice no., dates, tax, notes. */
export function EditBillSheet({
  bill,
  onOpenChange,
  onSubmit,
}: {
  bill: VendorBill | null
  onOpenChange: (open: boolean) => void
  onSubmit: (v: EditBillValues) => Promise<unknown>
}) {
  const form = useEditBillForm({
    bill,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={!!bill}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={`Edit ${bill?.billNo ?? ''}`}
      description="Only a draft can be edited; approving freezes it."
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
                Save
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
        <form.Field name="vendorInvoiceNo">
          {(f) => (
            <FormInput
              label="Lab's invoice no."
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="billDate">
            {(f) => (
              <FieldWrapper label="Bill date" required error={fieldError(f)}>
                <DatePicker
                  value={f.state.value || undefined}
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="dueOn">
            {(f) => (
              <FieldWrapper label="Due on">
                <DatePicker
                  value={f.state.value || undefined}
                  onChange={f.handleChange}
                  clearable
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <form.Field name="taxPercent">
          {(f) => (
            <FieldWrapper
              label="Tax %"
              htmlFor="edit-bill-tax"
              error={fieldError(f)}
            >
              <NumberInput
                id="edit-bill-tax"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="notes">
          {(f) => (
            <FieldWrapper
              label="Notes"
              htmlFor="edit-bill-notes"
              error={fieldError(f)}
            >
              <Textarea
                id="edit-bill-notes"
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

/** A hand-entered cost on a draft bill. */
export function AddBillLineSheet({
  open,
  billNo,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  billNo: string
  onOpenChange: (open: boolean) => void
  onSubmit: (v: BillLineValues) => Promise<unknown>
}) {
  const form = useBillLineForm({
    open,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={`Add a line to ${billNo}`}
      description="For costs the order doesn't carry, e.g. the lab's charge for work cancelled half-way."
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
                Add line
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
        <form.Field name="kind">
          {(f) => (
            <FormSelect
              label="Kind"
              required
              value={f.state.value}
              onValueChange={(v) => f.handleChange(v as BillLineKind)}
              options={KINDS}
            />
          )}
        </form.Field>
        <form.Field name="description">
          {(f) => (
            <FormInput
              label="Description"
              required
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="quantity">
            {(f) => (
              <FieldWrapper
                label="Quantity"
                htmlFor="line-qty"
                required
                error={fieldError(f)}
              >
                <NumberInput
                  id="line-qty"
                  mode="integer"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="unitCost">
            {(f) => (
              <FieldWrapper
                label={`Unit cost (${activeCurrency()})`}
                htmlFor="line-cost"
                required
                error={fieldError(f)}
              >
                <NumberInput
                  id="line-cost"
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
            const qty = /^\d+$/.test(v.quantity) ? Number(v.quantity) : 0
            const unit = rupeesToMinor(v.unitCost) ?? 0
            return (
              <p className="text-sm text-text-3">
                Line total{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatMinor(qty * unit)}
                </span>
              </p>
            )
          }}
        </form.Subscribe>
      </form>
    </FormSheet>
  )
}

/** Use a payment's unallocated rest (an advance) on the lab's open bills. */
export function AllocatePaymentSheet({
  payment,
  bills,
  onOpenChange,
  onSubmit,
}: {
  payment: VendorPayment | null
  /** The lab's approved bills with a balance. */
  bills: VendorBill[]
  onOpenChange: (open: boolean) => void
  onSubmit: (v: AllocateValues) => Promise<unknown>
}) {
  const form = useAllocateForm({
    payment,
    bills,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={!!payment}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={`Apply ${payment?.paymentNo ?? ''} to bills`}
      description={`${formatMinor(payment?.unallocatedMinor ?? 0)} of this payment is an advance to ${payment?.labName ?? 'the lab'}.`}
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
                Apply
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        {bills.length === 0 && (
          <p className="text-sm text-text-3">
            This lab has no approved bills with a balance.
          </p>
        )}
        <form.Field name="allocations" mode="array">
          {(arr) => (
            <>
              {arr.state.value.map((a, i) => (
                <form.Field key={a.billId} name={`allocations[${i}].amount`}>
                  {(f) => (
                    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">{a.billNo}</p>
                        <p className="text-xs text-text-3">
                          Balance {formatMinor(a.balanceMinor)}
                        </p>
                      </div>
                      <FieldWrapper error={fieldError(f)} className="w-36">
                        <NumberInput
                          aria-label={`Amount for ${a.billNo}`}
                          placeholder="0"
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                        />
                      </FieldWrapper>
                    </div>
                  )}
                </form.Field>
              ))}
              {fieldError(arr) && (
                <p className="text-sm text-destructive">{fieldError(arr)}</p>
              )}
            </>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
