import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/shared/DatePicker'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/formatters'
import { CalendarX2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { fieldError } from '@/components/forms/fieldError'
import {
  useAvailabilityOverrides,
  useDeleteOverride,
} from '../hooks/useAvailabilityOverrides'
import { useOverrideForm } from '../hooks/useOverrideForm'
import type { AvailabilityOverride } from '../types'

interface AvailabilityOverrideTabProps {
  employeeId: string
}

export function AvailabilityOverrideTab({
  employeeId,
}: AvailabilityOverrideTabProps) {
  const { data: overrides, isLoading } = useAvailabilityOverrides(employeeId)
  const deleteMutation = useDeleteOverride(employeeId)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<AvailabilityOverride | null>(null)

  const openCreate = () => {
    setEditing(null)
    setIsFormOpen(true)
  }

  const openEdit = (override: AvailabilityOverride) => {
    setEditing(override)
    setIsFormOpen(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Availability Overrides</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Date-specific exceptions to the weekly schedule (days off or
              special hours)
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Add Override
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!overrides || overrides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="rounded-full bg-muted p-5">
              <CalendarX2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No overrides set</p>
            <p className="text-sm text-muted-foreground">
              Add an override for a day off or special working hours
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    {formatDate(o.date)}
                  </TableCell>
                  <TableCell>
                    {o.isAvailable ? (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 border-green-200"
                      >
                        Available
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-red-100 text-red-700 border-red-200"
                      >
                        Unavailable
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.isAvailable && o.overrideHours?.length
                      ? o.overrideHours
                          .map((s) => `${s.startTime}–${s.endTime}`)
                          .join(', ')
                      : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {o.reason || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(o)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => deleteMutation.mutate(o.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <OverrideFormDialog
        employeeId={employeeId}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        override={editing}
      />
    </Card>
  )
}

// ─── Form Dialog ────────────────────────────────────────────────────

interface OverrideFormDialogProps {
  employeeId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  override?: AvailabilityOverride | null
}

function OverrideFormDialog({
  employeeId,
  isOpen,
  onOpenChange,
  override,
}: OverrideFormDialogProps) {
  const { form, isEditing, isPending } = useOverrideForm({
    employeeId,
    isOpen,
    override,
    onDone: () => onOpenChange(false),
  })

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Override' : 'New Availability Override'}
          </DialogTitle>
          <DialogDescription>
            Mark a specific date as unavailable, or set special working hours
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 py-2"
        >
          <form.Field name="date">
            {(field) => (
              <div className="space-y-2">
                <Label>Date</Label>
                <DatePicker
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  className={fieldError(field) ? 'border-destructive' : ''}
                />
                {fieldError(field) && (
                  <p className="text-xs text-destructive">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="isAvailable">
            {(field) => (
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <Label>Available this day</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Off = day off; On = special working hours
                  </p>
                </div>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(val) => field.handleChange(val)}
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.isAvailable}>
            {(isAvailable) =>
              isAvailable ? (
                <form.Field name="overrideHours">
                  {(arrayField) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Working Hours</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            (arrayField as any).pushValue({
                              startTime: '09:00',
                              endTime: '17:00',
                            })
                          }
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add Slot
                        </Button>
                      </div>
                      {arrayField.state.value.map((_, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <form.Field name={`overrideHours[${idx}].startTime`}>
                            {(subField) => (
                              <div className="flex-1 space-y-1">
                                <Input
                                  type="time"
                                  value={subField.state.value}
                                  onChange={(e) =>
                                    subField.handleChange(e.target.value)
                                  }
                                  onBlur={subField.handleBlur}
                                />
                                {fieldError(subField) && (
                                  <p className="text-xs text-destructive">
                                    {fieldError(subField)}
                                  </p>
                                )}
                              </div>
                            )}
                          </form.Field>
                          <span className="pt-2 text-xs text-muted-foreground">
                            to
                          </span>
                          <form.Field name={`overrideHours[${idx}].endTime`}>
                            {(subField) => (
                              <div className="flex-1 space-y-1">
                                <Input
                                  type="time"
                                  value={subField.state.value}
                                  onChange={(e) =>
                                    subField.handleChange(e.target.value)
                                  }
                                  onBlur={subField.handleBlur}
                                />
                                {fieldError(subField) && (
                                  <p className="text-xs text-destructive">
                                    {fieldError(subField)}
                                  </p>
                                )}
                              </div>
                            )}
                          </form.Field>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => (arrayField as any).removeValue(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>

          <form.Field name="reason">
            {(field) => (
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea
                  placeholder="e.g. Conference, public holiday..."
                  rows={2}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={isPending || !canSubmit || isSubmitting}
                >
                  {(isPending || isSubmitting) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditing ? 'Save Changes' : 'Create Override'}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
