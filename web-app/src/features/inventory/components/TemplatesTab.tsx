import { useState } from 'react'
import { Can } from '@/features/access/components/Can'
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
} from '@/components/shared/SearchableSelect'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Trash2, MoreHorizontal, Loader2 } from 'lucide-react'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { APPOINTMENT_TYPE_OPTIONS } from '@/features/appointments/types'
import {
  useConsumptionTemplates,
  useDeleteTemplate,
} from '../hooks/useConsumptionTemplates'
import { useTemplateForm } from '../hooks/useTemplateForm'
import { listError } from '../lib/listError'
import { ItemPicker } from './ItemPicker'
import type { ConsumptionTemplate } from '../types'

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
        <Can perm="inventory.stock.adjust">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Template
          </Button>
        </Can>
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
                      {t.items.length}
                    </TableCell>
                    <TableCell>
                      <Can perm="inventory.stock.adjust">
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
                      </Can>
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

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  template: ConsumptionTemplate | null
}) {
  const { form, isEdit } = useTemplateForm({
    open,
    template,
    onDone: () => onOpenChange(false),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'Add Template'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="name">
              {(f) => (
                <FieldWrapper
                  label="Template Name"
                  htmlFor="template-name"
                  required
                  error={fieldError(f)}
                >
                  <Input
                    id="template-name"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    placeholder="Root Canal Kit"
                    aria-invalid={!!fieldError(f)}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="procedureName">
              {(f) => (
                <FieldWrapper
                  label="Procedure"
                  htmlFor="template-procedure"
                  required
                  error={fieldError(f)}
                >
                  <Input
                    id="template-procedure"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    placeholder="Root Canal"
                    aria-invalid={!!fieldError(f)}
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>

          <form.Field name="appointmentType">
            {(f) => (
              <FieldWrapper label="Appointment Type (for auto-matching)">
                <Select
                  value={f.state.value || 'none'}
                  onValueChange={(v) => f.handleChange(v === 'none' ? '' : v)}
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
              </FieldWrapper>
            )}
          </form.Field>

          <form.Field name="items" mode="array">
            {(items) => (
              <>
                <div className="space-y-2">
                  <Label>Add Items to Kit</Label>
                  <ItemPicker
                    onSelect={(item) => {
                      if (
                        items.state.value.some(
                          (p) => p.inventoryItemId === item.id,
                        )
                      )
                        return
                      items.pushValue({
                        inventoryItemId: item.id,
                        name: item.name,
                        unit: item.unit,
                        quantity: '1',
                        notes: '',
                      })
                    }}
                    selectedIds={items.state.value.map(
                      (i) => i.inventoryItemId,
                    )}
                  />
                  {listError(items) && (
                    <p className="text-xs font-medium text-danger">
                      {listError(items)}
                    </p>
                  )}
                </div>

                {items.state.value.length > 0 && (
                  <div className="space-y-2 rounded-md border p-2">
                    {items.state.value.map((it, idx) => (
                      <div
                        key={it.inventoryItemId}
                        className="flex items-start gap-2"
                      >
                        <div className="flex-1 pt-5">
                          <p className="text-sm font-medium">{it.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {it.unit}
                          </p>
                        </div>
                        <form.Field name={`items[${idx}].quantity`}>
                          {(f) => (
                            <div className="w-24 space-y-1">
                              <Label className="text-xs">Qty</Label>
                              <NumberInput
                                mode="decimal"
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                onBlur={f.handleBlur}
                                aria-invalid={!!fieldError(f)}
                              />
                              {fieldError(f) && (
                                <p className="text-xs font-medium text-danger">
                                  {fieldError(f)}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>
                        <form.Field name={`items[${idx}].notes`}>
                          {(f) => (
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs">Notes</Label>
                              <Input
                                value={f.state.value}
                                onChange={(e) => f.handleChange(e.target.value)}
                                onBlur={f.handleBlur}
                                placeholder="use 2 if molar…"
                              />
                              {fieldError(f) && (
                                <p className="text-xs font-medium text-danger">
                                  {fieldError(f)}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>
                        <TooltipButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          tooltip="Remove item"
                          onClick={() => items.removeValue(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </TooltipButton>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEdit ? 'Save Changes' : 'Create Template'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  )
}
