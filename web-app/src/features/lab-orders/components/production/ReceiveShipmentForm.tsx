import { Loader2, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useReceiveShipmentForm } from '../../hooks/useProduction'
import type { ReceiveLineInput, Shipment } from '../../production.types'

const CONDITIONS = [
  { value: 'ok', label: 'OK' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'missing', label: 'Missing' },
]
const QC = [
  { value: 'pass', label: 'QC pass' },
  { value: 'fail', label: 'QC fail' },
  { value: '', label: 'Not checked' },
]

/**
 * Receive the open lines of a lab → clinic shipment (lab ERD §10): per
 * line what arrived, its condition and the incoming QC. Unticked lines stay
 * open for later (partial receiving).
 */
export function ReceiveShipmentForm({
  shipment,
  onSubmit,
  submitLabel = 'Receive',
}: {
  shipment: Shipment
  onSubmit: (lines: ReceiveLineInput[]) => Promise<unknown>
  submitLabel?: string
}) {
  const form = useReceiveShipmentForm({ shipment, onSubmit })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="lines" mode="array">
        {(linesField) => (
          <div className="space-y-3">
            {linesField.state.value.map((l, i) => (
              <div
                key={l.shipmentItemId}
                className="space-y-3 rounded-lg border border-border p-3"
              >
                <form.Field name={`lines[${i}].include`}>
                  {(f) => (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={f.state.value}
                        onCheckedChange={(v) => f.handleChange(v === true)}
                        aria-label={`Receive ${l.label}`}
                      />
                      {l.label}
                      <span className="text-xs font-normal text-text-3">
                        × {l.line.quantity}
                      </span>
                    </label>
                  )}
                </form.Field>
                {l.include && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <form.Field name={`lines[${i}].line.condition`}>
                      {(f) => (
                        <FormSelect
                          label="Condition"
                          value={f.state.value}
                          onValueChange={(v) => {
                            const c = v as 'ok' | 'damaged' | 'missing'
                            f.handleChange(c)
                            form.setFieldValue(
                              `lines[${i}].line.receivedQty`,
                              c === 'missing' ? 0 : l.line.quantity,
                            )
                          }}
                          options={CONDITIONS}
                        />
                      )}
                    </form.Field>
                    <form.Field name={`lines[${i}].line.receivedQty`}>
                      {(f) => (
                        <FieldWrapper
                          label="Received"
                          htmlFor={`rcv-qty-${i}`}
                          error={fieldError(f)}
                        >
                          <Input
                            id={`rcv-qty-${i}`}
                            type="number"
                            min={0}
                            max={l.line.quantity}
                            value={f.state.value}
                            disabled={l.line.condition === 'missing'}
                            onChange={(e) =>
                              f.handleChange(Number(e.target.value))
                            }
                            onBlur={f.handleBlur}
                          />
                        </FieldWrapper>
                      )}
                    </form.Field>
                    <form.Field name={`lines[${i}].line.qcResult`}>
                      {(f) => (
                        <FormSelect
                          label="Incoming QC"
                          value={f.state.value}
                          disabled={l.line.condition === 'missing'}
                          onValueChange={(v) =>
                            f.handleChange(v as 'pass' | 'fail' | '')
                          }
                          options={QC}
                        />
                      )}
                    </form.Field>
                    <form.Field name={`lines[${i}].line.qcNotes`}>
                      {(f) => (
                        <FieldWrapper
                          label="Notes"
                          htmlFor={`rcv-notes-${i}`}
                          error={fieldError(f)}
                          className="sm:col-span-3"
                        >
                          <Input
                            id={`rcv-notes-${i}`}
                            value={f.state.value}
                            placeholder="e.g. box cracked, shade looks off"
                            onChange={(e) => f.handleChange(e.target.value)}
                            onBlur={f.handleBlur}
                          />
                        </FieldWrapper>
                      )}
                    </form.Field>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PackageCheck className="size-4" />
            )}
            {submitLabel}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}

/** The receive form in a side sheet (from the order page). */
export function ReceiveShipmentSheet({
  shipment,
  onOpenChange,
  onSubmit,
}: {
  shipment: Shipment | null
  onOpenChange: (open: boolean) => void
  onSubmit: (lines: ReceiveLineInput[]) => Promise<unknown>
}) {
  return (
    <FormSheet
      open={!!shipment}
      onOpenChange={onOpenChange}
      title={`Receive ${shipment?.shipmentNo ?? ''}`}
      description="Record what arrived. Untick lines that haven’t come yet — they stay open."
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      {shipment && (
        <ReceiveShipmentForm
          shipment={shipment}
          onSubmit={async (lines) => {
            await onSubmit(lines)
            onOpenChange(false)
          }}
        />
      )}
    </FormSheet>
  )
}
