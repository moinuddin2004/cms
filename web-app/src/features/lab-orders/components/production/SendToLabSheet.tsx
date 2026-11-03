import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NumberInput } from '@/components/forms/NumberInput'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useSendToLabForm } from '../../hooks/useProduction'
import { SHIPMENT_CONTENTS_LABEL } from '../../production.types'
import type { ProductionItem, ShipmentContents } from '../../production.types'
import type { productionApi } from '../../services/production.api'

const CONTENTS = (
  Object.keys(SHIPMENT_CONTENTS_LABEL) as ShipmentContents[]
).map((value) => ({ value, label: SHIPMENT_CONTENTS_LABEL[value] }))

/**
 * Send impressions / models / work from the clinic to the lab (lab ERD
 * §5b, `POST /lab-shipments`). The lab receives it on its production board.
 */
export function SendToLabSheet({
  open,
  items,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  items: ProductionItem[]
  onOpenChange: (open: boolean) => void
  onSubmit: (
    body: Parameters<typeof productionApi.sendToLab>[0],
  ) => Promise<unknown>
}) {
  const form = useSendToLabForm({
    open,
    items,
    onSubmit: async (body) => {
      await onSubmit(body)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Send to lab"
      description="Dispatch impressions, models or work to the lab. Untick items that aren’t going in this parcel."
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
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Dispatch
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
        <form.Field name="lines" mode="array">
          {(linesField) => (
            <div className="space-y-3">
              {linesField.state.value.length === 0 && (
                <p className="text-sm text-text-3">
                  No item on this order can be sent to the lab.
                </p>
              )}
              {linesField.state.value.map((l, i) => (
                <div
                  key={l.itemId}
                  className="space-y-3 rounded-lg border border-border p-3"
                >
                  <form.Field name={`lines[${i}].include`}>
                    {(f) => (
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={f.state.value}
                          onCheckedChange={(v) => f.handleChange(v === true)}
                          aria-label={`Send ${l.label}`}
                        />
                        {l.label}
                      </label>
                    )}
                  </form.Field>
                  {l.include && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <form.Field name={`lines[${i}].contents`}>
                        {(f) => (
                          <FormSelect
                            label="Contents"
                            value={f.state.value}
                            onValueChange={(v) =>
                              f.handleChange(v as ShipmentContents)
                            }
                            options={CONTENTS}
                          />
                        )}
                      </form.Field>
                      <form.Field name={`lines[${i}].quantity`}>
                        {(f) => (
                          <FieldWrapper
                            label="Quantity"
                            htmlFor={`send-qty-${i}`}
                            error={fieldError(f)}
                          >
                            <NumberInput
                              id={`send-qty-${i}`}
                              mode="integer"
                              value={f.state.value}
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
              {fieldError(linesField) && (
                <p className="text-sm text-destructive">
                  {fieldError(linesField)}
                </p>
              )}
            </div>
          )}
        </form.Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <form.Field name="courierName">
            {(f) => (
              <FieldWrapper
                label="Courier"
                htmlFor="send-courier"
                error={fieldError(f)}
              >
                <Input
                  id="send-courier"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="trackingNo">
            {(f) => (
              <FieldWrapper
                label="Tracking no."
                htmlFor="send-tracking"
                error={fieldError(f)}
              >
                <Input
                  id="send-tracking"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <form.Field name="notes">
          {(f) => (
            <FieldWrapper
              label="Notes for the lab"
              htmlFor="send-notes"
              error={fieldError(f)}
            >
              <Textarea
                id="send-notes"
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
