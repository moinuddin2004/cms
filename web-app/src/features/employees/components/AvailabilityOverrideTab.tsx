import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { formatDate } from '@/lib/formatters'
import {
  CalendarX2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  useAvailabilityOverrides,
  useCreateOverride,
  useUpdateOverride,
  useDeleteOverride,
} from '../hooks/useAvailabilityOverrides'
import {
  overrideFormSchema,
  type AvailabilityOverride,
  type OverrideFormData,
} from '../types'

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
  const createMutation = useCreateOverride(employeeId)
  const updateMutation = useUpdateOverride(employeeId)
  const isEditing = !!override
  const isPending = createMutation.isPending || updateMutation.isPending

  const form = useForm<OverrideFormData>({
    resolver: zodResolver(overrideFormSchema),
    defaultValues: {
      date: '',
      isAvailable: false,
      reason: '',
      overrideHours: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'overrideHours',
  })

  const isAvailable = form.watch('isAvailable')

  useEffect(() => {
    if (isOpen) {
      form.reset({
        date: override?.date ?? '',
        isAvailable: override?.isAvailable ?? false,
        reason: override?.reason ?? '',
        overrideHours: override?.overrideHours ?? [],
      })
    }
  }, [isOpen, override, form])

  async function onSubmit(data: OverrideFormData) {
    const payload = {
      ...data,
      overrideHours: data.isAvailable ? data.overrideHours : undefined,
    }
    try {
      if (isEditing && override) {
        await updateMutation.mutateAsync({ id: override.id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onOpenChange(false)
      form.reset()
    } catch {
      // toast handled in hooks
    }
  }

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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-2"
          >
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isAvailable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <FormLabel>Available this day</FormLabel>
                    <p className="text-xs text-muted-foreground mt-1">
                      Off = day off; On = special working hours
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {isAvailable && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Working Hours</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({ startTime: '09:00', endTime: '17:00' })
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Slot
                  </Button>
                </div>
                {fields.map((slot, idx) => (
                  <div key={slot.id} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`overrideHours.${idx}.startTime`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <FormField
                      control={form.control}
                      name={`overrideHours.${idx}.endTime`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => remove(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {form.formState.errors.overrideHours && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.overrideHours.message as string}
                  </p>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Conference, public holiday..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? 'Save Changes' : 'Create Override'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
