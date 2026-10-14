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
import { Plus, Minus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import { useConsumptionTemplates, useTemplateByAppointmentType } from '../hooks/useConsumptionTemplates'
import { useRecordConsumption } from '../hooks/usePatientConsumption'
import { ItemPicker } from './ItemPicker'
import type { ConsumptionTemplate } from '../types'

interface RecorderLine {
  inventoryItemId: string
  name: string
  unit: string
  unitPrice: number
  available: number
  quantity: number
  wasFromTemplate: boolean
}

export interface ConsumptionRecorderProps {
  patientId: string
  appointmentId?: string
  treatmentPlanId?: string
  appointmentType?: string
  onSaved?: () => void
  onCancel?: () => void
}

export function ConsumptionRecorder({
  patientId,
  appointmentId,
  treatmentPlanId,
  appointmentType,
  onSaved,
  onCancel,
}: ConsumptionRecorderProps) {
  const { data: matchedTemplate } = useTemplateByAppointmentType(appointmentType)
  const { data: allTemplates } = useConsumptionTemplates()
  const recordMutation = useRecordConsumption()

  const [lines, setLines] = useState<RecorderLine[]>([])
  const [templateId, setTemplateId] = useState<string | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)

  const applyTemplate = (template: ConsumptionTemplate) => {
    setTemplateId(template.id)
    setLines(
      (template.items ?? []).map((it) => ({
        inventoryItemId: it.inventoryItemId,
        name: it.inventoryItem?.name ?? 'Item',
        unit: it.inventoryItem?.unit ?? '',
        unitPrice: Number(it.inventoryItem?.unitPrice ?? 0),
        available: Number(it.inventoryItem?.currentStock ?? 0),
        quantity: Number(it.quantity),
        wasFromTemplate: true,
      })),
    )
  }

  // Auto-match on mount when an appointmentType template is found
  useEffect(() => {
    if (matchedTemplate && !autoFilled && lines.length === 0) {
      applyTemplate(matchedTemplate)
      setAutoFilled(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedTemplate])

  const setLine = (idx: number, patch: Partial<RecorderLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const addItem = (item: {
    id: string
    name: string
    unit: string
    unitPrice: number
    currentStock: number
  }) => {
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.inventoryItemId === item.id)
      if (existing >= 0) {
        return prev.map((l, i) =>
          i === existing ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          available: Number(item.currentStock),
          quantity: 1,
          wasFromTemplate: false,
        },
      ]
    })
  }

  const handleSelectTemplate = (id: string) => {
    const template = allTemplates?.find((t) => t.id === id)
    if (!template) return
    if (lines.length > 0) {
      if (!confirm('Replace current items with template items?')) return
    }
    applyTemplate(template)
  }

  const estCost = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0,
  )
  const hasInsufficient = lines.some((l) => l.quantity > l.available)

  const submit = () => {
    const valid = lines.filter((l) => Number(l.quantity) > 0)
    if (valid.length === 0) return
    recordMutation.mutate(
      {
        patientId,
        appointmentId,
        treatmentPlanId,
        templateId,
        notes: notes.trim() || undefined,
        items: valid.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: Number(l.quantity),
          wasFromTemplate: l.wasFromTemplate,
        })),
      },
      { onSuccess: () => onSaved?.() },
    )
  }

  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        {lines.map((line, idx) => {
          const insufficient = line.quantity > line.available
          return (
            <div
              key={line.inventoryItemId}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {line.name}{' '}
                  <span className="text-xs text-muted-foreground">
                    {line.unit}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {line.wasFromTemplate ? 'from template' : 'manually added'} ·
                  Available: {line.available} {line.unit}
                </p>
                {insufficient && (
                  <p className="text-xs font-medium text-red-600">
                    Insufficient stock!
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    setLine(idx, {
                      quantity: Math.max(0.01, line.quantity - 1),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className={cn(
                    'h-7 w-16 text-center',
                    insufficient && 'border-red-500',
                  )}
                  value={line.quantity}
                  onChange={(e) =>
                    setLine(idx, { quantity: Number(e.target.value) })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setLine(idx, { quantity: line.quantity + 1 })}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          )
        })}
        {lines.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No items yet — add items or select a template
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Add Item</Label>
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
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          Total items: {lines.length}
        </span>
        <span className="font-semibold">
          Est. cost: {formatCurrency(estCost)}
        </span>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          className="h-16 resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={recordMutation.isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={submit}
          disabled={
            recordMutation.isPending || lines.length === 0 || hasInsufficient
          }
        >
          {recordMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Consumption
        </Button>
      </div>
    </div>
  )
}
