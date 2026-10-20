import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FieldWrapper,
  FormInput,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { formatPaisa, rupeesToPaisa } from '@/features/lab-catalog'
import { fieldError } from '@/features/queue'
import { useApproveBillForm, usePayLabForm } from '../hooks/usePayablesForms'
import { percentToBp } from '../schemas/lab-payables.schema'
import type {
  ApproveBillValues,
  PayLabValues,
} from '../schemas/lab-payables.schema'
import { METHOD_LABEL } from '../types'
import type { PaymentMethod, VendorBill } from '../types'

const METHODS = (Object.keys(METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: METHOD_LABEL[value],
}))

/**
 * Approve a draft (lab ERD §10): the lab's invoice no., due date and tax.
 * Approving posts Lab Cost / Lab Payable; the bill can then be paid.
 */
export function ApproveBillSheet({
  bill,
  onOpenChange,
  onSubmit,
}: {
  bill: VendorBill | null
  onOpenChange: (open: boolean) => void
  onSubmit: (v: ApproveBillValues) => Promise<unknown>
}) {
  const form = useApproveBillForm({
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
      title={`Approve ${bill?.billNo ?? ''}`}
      description="Match it with the lab's invoice first. Once approved the amount is owed to the lab and the bill is frozen."
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
                Approve bill
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
              hint="Stops the same lab invoice being entered twice."
            />
          )}
        </form.Field>
        <form.Field name="dueOn">
          {(f) => (
            <FieldWrapper
              label="Due on"
              hint="Empty = bill date + the lab's payment terms."
            >
              <DatePicker
                value={f.state.value || undefined}
                onChange={f.handleChange}
                clearable
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="taxPercent">
          {(f) => (
            <FormInput
              label="Tax %"
              inputMode="decimal"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.taxPercent}>
          {(tax) => {
            const bp = percentToBp(tax) ?? 0
            const sub = bill?.subtotalPaisa ?? 0
            const taxPaisa = Math.round((sub * bp) / 10_000)
            return (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <Row label="Subtotal" value={formatPaisa(sub)} />
                <Row label="Tax" value={formatPaisa(taxPaisa)} />
                <Row
                  label="Total owed"
                  value={formatPaisa(sub + taxPaisa)}
                  strong
                />
              </div>
            )
          }}
        </form.Subscribe>
      </form>
    </FormSheet>
  )
}

const Row = ({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) => (
  <div
    className={`flex justify-between ${strong ? 'font-semibold' : 'text-text-3'}`}
  >
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
)

/**
 * Pay a lab (lab ERD §6b): one amount split over its open bills; whatever
 * is not split stays an advance to the lab.
 */
export function PayLabSheet({
  open,
  labName,
  bills,
  prefillBillId,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  labName: string
  /** The lab's approved bills with a balance. */
  bills: VendorBill[]
  prefillBillId?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (v: PayLabValues) => Promise<unknown>
}) {
  const form = usePayLabForm({
    open,
    bills,
    prefillBillId,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={`Pay ${labName}`}
      description="Never more than a bill's balance; an amount not split over bills stays as an advance for later bills."
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
                Record payment
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
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="amount">
            {(f) => (
              <FormInput
                label="Amount (PKR)"
                required
                inputMode="decimal"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                error={fieldError(f)}
              />
            )}
          </form.Field>
          <form.Field name="method">
            {(f) => (
              <FormSelect
                label="Method"
                required
                value={f.state.value}
                onValueChange={(v) => f.handleChange(v as PaymentMethod)}
                options={METHODS}
              />
            )}
          </form.Field>
          <form.Field name="reference">
            {(f) => (
              <FormInput
                label="Reference"
                placeholder="Cheque / transfer no."
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                error={fieldError(f)}
              />
            )}
          </form.Field>
          <form.Field name="paidOn">
            {(f) => (
              <FieldWrapper label="Paid on">
                <DatePicker
                  value={f.state.value || undefined}
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Split over bills</p>
          {bills.length === 0 && (
            <p className="text-sm text-text-3">
              No approved bills with a balance — the whole amount is an advance.
            </p>
          )}
          <form.Field name="allocations" mode="array">
            {(arr) =>
              arr.state.value.map((a, i) => (
                <form.Field key={a.billId} name={`allocations[${i}].amount`}>
                  {(f) => (
                    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">{a.billNo}</p>
                        <p className="text-xs text-text-3">
                          Balance {formatPaisa(a.balancePaisa)}
                        </p>
                      </div>
                      <FieldWrapper error={fieldError(f)} className="w-36">
                        <Input
                          aria-label={`Amount for ${a.billNo}`}
                          inputMode="decimal"
                          placeholder="0"
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                        />
                      </FieldWrapper>
                    </div>
                  )}
                </form.Field>
              ))
            }
          </form.Field>
        </div>
        <form.Subscribe selector={(s) => s.values}>
          {(v) => {
            const amount = rupeesToPaisa(v.amount) ?? 0
            const split = v.allocations.reduce(
              (s, a) => s + (rupeesToPaisa(a.amount) ?? 0),
              0,
            )
            return (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <Row label="Paid" value={formatPaisa(amount)} />
                <Row label="Split over bills" value={formatPaisa(split)} />
                <Row
                  label="Advance to the lab"
                  value={formatPaisa(Math.max(0, amount - split))}
                  strong
                />
              </div>
            )
          }}
        </form.Subscribe>
      </form>
    </FormSheet>
  )
}
