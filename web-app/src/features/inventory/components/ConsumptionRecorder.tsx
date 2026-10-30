import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { Plus, Minus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import {
  useConsumptionTemplates,
  useTemplateByAppointmentType,
} from '../hooks/useConsumptionTemplates'
import { useConsumptionForm } from '../hooks/useConsumptionForm'
import { listError } from '../lib/listError'
import type { ConsumptionLineValues } from '../schemas/inventory.schema'
import { ItemPicker } from './ItemPicker'
import type { ConsumptionTemplate } from '../types'

export interface ConsumptionRecorderProps {
  patientId: string
  appointmentId?: string
  treatmentPlanId?: string
  appointmentType?: string
  onSaved?: () => void
  onCancel?: () => void
}

/** Two-decimal rounding for the +/- steppers (avoids 0.30000000000000004). */
const step = (q: string, delta: number, floor = 0) =>
  String(Math.max(floor, Math.round(((Number(q) || 0) + delta) * 100) / 100))

export function ConsumptionRecorder({
  patientId,
  appointmentId,
  treatmentPlanId,
  appointmentType,
  onSaved,
  onCancel,
}: ConsumptionRecorderProps) {
  const { data: matchedTemplate } =
    useTemplateByAppointmentType(appointmentType)
  const { data: allTemplates } = useConsumptionTemplates()
  const { form } = useConsumptionForm({
    patientId,
    appointmentId,
    treatmentPlanId,
    onSaved,
  })
  const [autoFilled, setAutoFilled] = useState(false)

  const applyTemplate = (template: ConsumptionTemplate) => {
    form.setFieldValue('templateId', template.id)
    form.setFieldValue(
      'lines',
      template.items.map((it): ConsumptionLineValues => ({
        inventoryItemId: it.inventoryItemId,
        name: it.inventoryItem?.name ?? 'Item',
        unit: it.inventoryItem?.unit ?? '',
        unitPrice: Number(it.inventoryItem?.unitPrice ?? 0),
        available: Number(it.inventoryItem?.currentStock ?? 0),
        quantity: String(Number(it.quantity)),
        wasFromTemplate: true,
      })),
    )
  }

  // Auto-match on mount when an appointmentType template is found
  useEffect(() => {
    if (
      matchedTemplate &&
      !autoFilled &&
      form.state.values.lines.length === 0
    ) {
      applyTemplate(matchedTemplate)
      setAutoFilled(true)
    }
  }, [matchedTemplate])

  const addItem = (item: {
    id: string
    name: string
    unit: string
    unitPrice: number
    currentStock: number
  }) => {
    const lines = form.state.values.lines
    const existing = lines.findIndex((l) => l.inventoryItemId === item.id)
    if (existing >= 0) {
      form.setFieldValue(`lines[${existing}].quantity`, (q) => step(q, 1))
      return
    }
    form.pushFieldValue('lines', {
      inventoryItemId: item.id,
      name: item.name,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      available: Number(item.currentStock),
      quantity: '1',
      wasFromTemplate: false,
    })
  }

  const handleSelectTemplate = (id: string) => {
    const template = allTemplates?.find((t) => t.id === id)
    if (!template) return
    if (form.state.values.lines.length > 0) {
      if (!confirm('Replace current items with template items?')) return
    }
    applyTemplate(template)
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Items Used</h3>
          {matchedTemplate && autoFilled && (
            <p className="text-xs text-muted-foreground">
              Template: {matchedTemplate.name} (auto-matched)
            </p>
          )}
        </div>
        <Select onValueChange={handleSelectTemplate}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select Template" />
          </SelectTrigger>
          <SelectContent>
            {allTemplates?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form.Field name="lines" mode="array">
        {(lines) => (
          <div className="space-y-2">
            {lines.state.value.map((line, idx) => (
              <form.Field
                key={line.inventoryItemId}
                name={`lines[${idx}].quantity`}
              >
                {(f) => {
                  const insufficient = Number(f.state.value) > line.available
                  const error =
                    fieldError(f) ??
                    (insufficient ? 'Insufficient stock!' : undefined)
                  return (
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {line.name}{' '}
                          <span className="text-xs text-muted-foreground">
                            {line.unit}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {line.wasFromTemplate
                            ? 'from template'
                            : 'manually added'}{' '}
                          · Available: {line.available} {line.unit}
                        </p>
                        {error && (
                          <p className="text-xs font-medium text-red-600">
                            {error}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <TooltipButton
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          tooltip="Decrease quantity"
                          onClick={() =>
                            f.handleChange(step(f.state.value, -1, 0.01))
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </TooltipButton>
                        <Input
                          type="number"
                          min={0.01}
                          step="0.01"
                          className={cn(
                            'h-7 w-16 text-center',
                            error && 'border-red-500',
                          )}
                          value={f.state.value}
                          onChange={(e) => f.handleChange(e.target.value)}
                          onBlur={f.handleBlur}
                          aria-invalid={!!error}
                        />
                        <TooltipButton
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          tooltip="Increase quantity"
                          onClick={() => f.handleChange(step(f.state.value, 1))}
                        >
                          <Plus className="h-3 w-3" />
                        </TooltipButton>
                        <TooltipButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          tooltip="Remove item"
                          onClick={() => lines.removeValue(idx)}
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipButton>
                      </div>
                    </div>
                  )
                }}
              </form.Field>
            ))}
            {lines.state.value.length === 0 && (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No items yet — add items or select a template
              </p>
            )}
            {lines.state.value.length === 0 && listError(lines) && (
              <p className="text-xs font-medium text-danger">
                {listError(lines)}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <div className="space-y-2">
        <Label className="text-xs">Add Item</Label>
        <form.Subscribe selector={(s) => s.values.lines}>
          {(lines) => (
            <ItemPicker
              onSelect={(item) =>
                addItem({
                  id: item.id,
                  name: item.name,
                  unit: item.unit,
                  unitPrice: Number(item.unitPrice),
                  currentStock: Number(item.currentStock),
                })
              }
              selectedIds={lines.map((l) => l.inventoryItemId)}
            />
          )}
        </form.Subscribe>
      </div>

      <form.Subscribe selector={(s) => s.values.lines}>
        {(lines) => (
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Total items: {lines.length}
            </span>
            <span className="font-semibold">
              Est. cost:{' '}
              {formatCurrency(
                lines.reduce(
                  (s, l) =>
                    s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
                  0,
                ),
              )}
            </span>
          </div>
        )}
      </form.Subscribe>

      <form.Field name="notes">
        {(f) => (
          <FieldWrapper
            label="Notes"
            htmlFor="consumption-notes"
            error={fieldError(f)}
          >
            <Textarea
              id="consumption-notes"
              className="h-16 resize-none"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Subscribe
        selector={(s) =>
          [
            s.canSubmit,
            s.isSubmitting,
            s.values.lines.length === 0 ||
              s.values.lines.some((l) => Number(l.quantity) > l.available),
          ] as const
        }
      >
        {([canSubmit, isSubmitting, blocked]) => (
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || blocked}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Consumption
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}
