import { useState } from 'react'
import { Loader2, Paperclip, Trash2 } from 'lucide-react'
import { NumberInput } from '@/components/forms/NumberInput'
import { Switch } from '@/components/ui/switch'
import { FieldWrapper, FormSelect } from '@/components/shared'
import { FileUploadField } from '@/components/shared/FileUploadField'
import { MultiSelect } from '@/components/shared/MultiSelect'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { DynamicFormFields, readFields } from '@/features/engine-studio'
import type { RenderFile } from '@/features/engine-studio'
import { formatMinor } from '@/features/lab-catalog'
import type { ClinicServiceRow } from '@/features/lab-catalog'
import { toastOrderError } from '../lib/order-errors'
import type { OrderItemFormValues } from '../schemas/lab-order.schema'
import { labOrdersApi } from '../services/lab-orders.api'
import type { OrderIssue } from '../types'

export interface LineForm {
  schemaJson: unknown
  uiJson: unknown
}

/**
 * One order line: the service, its options, rush, quantity (per-tooth
 * services count their teeth) and the service's order form — the same
 * renderer the Studio previews with, tooth chart included.
 */
export function OrderItemEditor({
  index,
  value,
  onChange,
  onRemove,
  services,
  form,
  orderId,
  issues,
}: {
  index: number
  value: OrderItemFormValues
  onChange: (next: OrderItemFormValues) => void
  onRemove?: () => void
  services: ClinicServiceRow[]
  form: LineForm | null
  /** Files need a saved draft to hang off. */
  orderId: string | null
  issues: OrderIssue[]
}) {
  const service = services.find((s) => s.id === value.labServiceId)
  const fields = form ? readFields(form.schemaJson) : []
  const errorFor = (key: string) =>
    issues.find((i) => i.path === key || i.path.startsWith(`${key}.`))?.message

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">Item {index + 1}</p>
        {onRemove && (
          <TooltipButton
            tooltip={`Remove item ${index + 1}`}
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </TooltipButton>
        )}
      </div>
      <FormSelect
        label="Service"
        required
        value={value.labServiceId}
        onValueChange={(labServiceId) =>
          onChange({ ...value, labServiceId, optionIds: [], answers: {} })
        }
        options={services.map((s) => ({
          value: s.id,
          label: `${s.name}${s.price ? ` — ${formatMinor(s.price.unitPriceMinor)}` : ''}`,
        }))}
        placeholder="Choose a service"
      />
      {service && (
        <div className="grid gap-4 sm:grid-cols-3">
          {service.options.length > 0 && (
            <FieldWrapper
              label="Options"
              htmlFor={`opt-${index}`}
              className="sm:col-span-2"
            >
              <MultiSelect
                id={`opt-${index}`}
                options={service.options
                  .filter((o) => o.isActive)
                  .map((o) => ({
                    value: o.id,
                    label: `${o.name} (+${formatMinor(o.extraCostMinor)})`,
                  }))}
                value={value.optionIds}
                onChange={(optionIds) => onChange({ ...value, optionIds })}
              />
            </FieldWrapper>
          )}
          {service.unitType !== 'per_tooth' && (
            <FieldWrapper label="Quantity" htmlFor={`qty-${index}`}>
              <NumberInput
                id={`qty-${index}`}
                mode="integer"
                value={value.quantity}
                onChange={(e) =>
                  onChange({ ...value, quantity: e.target.value })
                }
              />
            </FieldWrapper>
          )}
          <FieldWrapper
            label="Rush"
            htmlFor={`rush-${index}`}
            hint="Lab rush surcharge applies"
          >
            <Switch
              id={`rush-${index}`}
              checked={value.rush}
              onCheckedChange={(rush) => onChange({ ...value, rush })}
            />
          </FieldWrapper>
        </div>
      )}
      {service && fields.length > 0 && (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <DynamicFormFields
            fields={fields}
            ui={form?.uiJson}
            answers={value.answers}
            onChange={(key, v) =>
              onChange({ ...value, answers: { ...value.answers, [key]: v } })
            }
            errorFor={errorFor}
            renderFile={fileRenderer(orderId)}
          />
        </div>
      )}
      {issues
        .filter((i) => !fields.some((f) => i.path === f.key))
        .map((i, n) => (
          <p key={n} className="text-sm text-destructive">
            {i.message}
          </p>
        ))}
    </div>
  )
}

/** File answers = attachment ids; uploads go to the saved draft. */
function fileRenderer(orderId: string | null): RenderFile {
  return function FileAnswer(field, value, onChange) {
    return (
      <FileAnswerInput
        orderId={orderId}
        label={field.label}
        value={value}
        onChange={onChange}
      />
    )
  }
}

function FileAnswerInput({
  orderId,
  label,
  value,
  onChange,
}: {
  orderId: string | null
  label: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  const ids = Array.isArray(value) ? (value as string[]) : []
  const [busy, setBusy] = useState(false)
  if (!orderId) {
    return (
      <p className="text-xs text-text-3">
        Save the draft first, then attach {label.toLowerCase()}.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <FileUploadField
        accept="*/*"
        maxSizeMb={50}
        disabled={busy}
        onFileSelected={async (file) => {
          if (!file) return
          setBusy(true)
          try {
            const up = await labOrdersApi.upload(orderId, file, {
              visibility: 'lab_shared',
            })
            onChange([...ids, up.id])
          } catch (err) {
            toastOrderError(err)
          } finally {
            setBusy(false)
          }
        }}
      />
      <p className="flex items-center gap-1.5 text-xs text-text-3">
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Paperclip className="size-3.5" />
        )}
        {ids.length
          ? `${ids.length} file${ids.length === 1 ? '' : 's'} attached`
          : 'No files yet'}
      </p>
    </div>
  )
}
