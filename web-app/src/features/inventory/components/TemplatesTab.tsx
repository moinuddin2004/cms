import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Trash2, MoreHorizontal, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { APPOINTMENT_TYPE_OPTIONS } from '@/features/appointments/types'
import {
  useConsumptionTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../hooks/useConsumptionTemplates'
import { ItemPicker } from './ItemPicker'
import type {
  ConsumptionTemplate,
  TemplateFormData,
  TemplateItemFormData,
} from '../types'

export function TemplatesTab() {
  const { data: templates, isLoading } = useConsumptionTemplates()
  const deleteMutation = useDeleteTemplate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ConsumptionTemplate | null>(null)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (t: ConsumptionTemplate) => {
    setEditing(t)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Template
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Appointment Type</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.procedureName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.appointmentType ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {t.items?.length ?? 0}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(`Deactivate "${t.name}"?`))
                                deleteMutation.mutate(t.id)
                            }}
                          >
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {templates && templates.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No templates yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
      />
    </div>
  )
}

interface DraftItem extends TemplateItemFormData {
  name: string
  unit: string
}

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  template: ConsumptionTemplate | null
}) {
  const isEdit = !!template
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()
  const [name, setName] = useState('')
  const [procedureName, setProcedureName] = useState('')
  const [appointmentType, setAppointmentType] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name)
        setProcedureName(template.procedureName)
        setAppointmentType(template.appointmentType ?? '')
        setItems(
          (template.items ?? []).map((it) => ({
            inventoryItemId: it.inventoryItemId,
            name: it.inventoryItem?.name ?? 'Item',
            unit: it.inventoryItem?.unit ?? '',
            quantity: Number(it.quantity),
            notes: it.notes ?? '',
          })),
        )
      } else {
        setName('')
        setProcedureName('')
        setAppointmentType('')
        setItems([])
      }
    }
  }, [open, template])

  const isPending = createMutation.isPending || updateMutation.isPending

  const addItem = (item: { id: string; name: string; unit: string }) => {
    setItems((prev) => {
      if (prev.some((p) => p.inventoryItemId === item.id)) return prev
      return [
        ...prev,
        { inventoryItemId: item.id, name: item.name, unit: item.unit, quantity: 1, notes: '' },
      ]
    })
  }
  const setItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const submit = () => {
    if (!name.trim() || !procedureName.trim()) {
      toast.error('Name and procedure are required')
      return
    }
    if (items.length === 0) {
      toast.error('Add at least one item')
      return
    }
    const payload: TemplateFormData = {
      name: name.trim(),
      procedureName: procedureName.trim(),
      appointmentType: appointmentType || undefined,
      items: items.map((it, i) => ({
        inventoryItemId: it.inventoryItemId,
        quantity: Number(it.quantity) || 1,
        notes: it.notes?.trim() || undefined,
        sortOrder: i,
      })),
    }
    if (isEdit && template) {
      updateMutation.mutate(
        { id: template.id, payload },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createMutation.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'Add Template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Root Canal Kit"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Procedure <span className="text-destructive">*</span>
              </Label>
              <Input
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                placeholder="Root Canal"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Appointment Type (for auto-matching)</Label>
            <Select
              value={appointmentType || 'none'}
              onValueChange={(v) =>
                setAppointmentType(v === 'none' ? '' : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {APPOINTMENT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Add Items to Kit</Label>
            <ItemPicker
              onSelect={(item) =>
                addItem({ id: item.id, name: item.name, unit: item.unit })
              }
              selectedIds={items.map((i) => i.inventoryItemId)}
            />
          </div>

          {items.length > 0 && (
            <div className="space-y-2 rounded-md border p-2">
              {items.map((it, idx) => (
                <div key={it.inventoryItemId} className="flex items-end gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.unit}</p>
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={it.quantity}
                      onChange={(e) =>
                        setItem(idx, { quantity: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={it.notes ?? ''}
                      onChange={(e) => setItem(idx, { notes: e.target.value })}
                      placeholder="use 2 if molar…"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
