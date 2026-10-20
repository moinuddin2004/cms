import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FieldWrapper,
  FormSelect,
  FormSheet,
  LoadingSkeleton,
} from '@/components/shared'
import { fieldError } from '@/features/queue'
import {
  useAssignForm,
  useDispatchForm,
  useShippableItems,
  useTechnicians,
} from '../useLabProduction'
import type { DispatchValues } from '../schemas'
import type { LabProductionItem } from '../types'

const itemLabel = (i: LabProductionItem) =>
  `${i.orderNo ?? ''} / ${i.lineNo} · ${i.serviceName ?? ''}${
    i.activeStage && !i.activeStage.isFinal
      ? ` — ${i.activeStage.name}${i.activeStage.roundNo > 1 ? ` (round ${i.activeStage.roundNo})` : ''}`
      : ' — final'
  } · ${i.clinic.name}`

/**
 * A lab → clinic shipment (lab ERD §14 step 6.2): try-in rounds at the lab
 * and finished work that passed QC. One shipment goes to one clinic.
 */
export function DispatchSheet({
  open,
  initialItemIds,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initialItemIds: string[]
  onOpenChange: (open: boolean) => void
  onSubmit: (v: DispatchValues) => Promise<unknown>
}) {
  const { data: items, isLoading } = useShippableItems(open)
  const form = useDispatchForm({
    open,
    initialItemIds,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Dispatch to clinic"
      description="Try-in work and finished work that passed QC. The slip’s QR code opens the clinic’s receive screen."
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
        <form.Field name="itemIds">
          {(f) => (
            <FieldWrapper label="Items" required error={fieldError(f)}>
              {isLoading ? (
                <LoadingSkeleton variant="table" />
              ) : !items?.length ? (
                <p className="text-sm text-text-3">
                  Nothing is ready to ship yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((i) => {
                    const checked = f.state.value.includes(i.id)
                    return (
                      <label
                        key={i.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            f.handleChange(
                              v === true
                                ? [...f.state.value, i.id]
                                : f.state.value.filter((x) => x !== i.id),
                            )
                          }
                          aria-label={`Ship ${itemLabel(i)}`}
                        />
                        {itemLabel(i)}
                      </label>
                    )
                  })}
                </div>
              )}
            </FieldWrapper>
          )}
        </form.Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.Field name="courierName">
            {(f) => (
              <FieldWrapper
                label="Courier"
                htmlFor="ship-courier"
                error={fieldError(f)}
              >
                <Input
                  id="ship-courier"
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
                htmlFor="ship-tracking"
                error={fieldError(f)}
              >
                <Input
                  id="ship-tracking"
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
              label="Notes"
              htmlFor="ship-notes"
              error={fieldError(f)}
            >
              <Textarea
                id="ship-notes"
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

/** A lab admin assigns the technician who works on an item. */
export function AssignSheet({
  item,
  onOpenChange,
  onSubmit,
}: {
  item: LabProductionItem | null
  onOpenChange: (open: boolean) => void
  onSubmit: (labMemberId: string) => Promise<unknown>
}) {
  const { data: techs } = useTechnicians()
  const form = useAssignForm({
    open: !!item,
    current: item?.assignee?.labMemberId ?? null,
    onSubmit: async (v) => {
      await onSubmit(v.labMemberId)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={!!item}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Assign technician"
      description={item ? itemLabel(item) : undefined}
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
                Assign
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form.Field name="labMemberId">
        {(f) => (
          <FormSelect
            label="Technician"
            required
            value={f.state.value}
            onValueChange={f.handleChange}
            error={fieldError(f)}
            options={(techs ?? []).map((t) => ({
              value: t.id,
              label: `${t.name ?? 'Unnamed'}${t.role === 'lab_admin' ? ' (admin)' : ''}`,
            }))}
          />
        )}
      </form.Field>
    </FormSheet>
  )
}
