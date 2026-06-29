import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from '@tanstack/react-form'
import { Loader2, Plus } from 'lucide-react'
import {
  useCreateTreatment,
  usePatientHistory,
} from '../../hooks/usePatientSubEntities'

const today = () => new Date().toISOString().slice(0, 10)

interface TreatmentFormDialogProps {
  patientId: string
  /** When set, the treatment is linked to this encounter (Flow E). */
  encounterId?: string
  /** Custom trigger; defaults to an "Add Treatment" button. */
  trigger?: React.ReactNode
}

export function TreatmentFormDialog({
  patientId,
  encounterId,
  trigger,
}: TreatmentFormDialogProps) {
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useCreateTreatment()
  const linkedMode = !!encounterId

  // Standalone mode lets the user optionally attach the treatment to a visit.
  const { data: history } = usePatientHistory(linkedMode ? '' : patientId)
  const encounters = history?.encounters ?? []

  const form = useForm({
    defaultValues: {
      treatmentName: '',
      notes: '',
      cost: undefined as number | undefined,
      date: today(),
      encounterId: encounterId ?? '',
    },
    onSubmit: async ({ value }) => {
      mutate(
        {
          patientId,
          treatmentName: value.treatmentName.trim(),
          notes: value.notes || undefined,
          cost: value.cost,
          date: value.date || undefined,
          encounterId: value.encounterId || undefined,
        },
        {
          onSuccess: () => {
            form.reset()
            setOpen(false)
          },
        },
      )
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-2" size={16} /> Add Treatment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {linkedMode ? 'Add Treatment to Visit' : 'Record Treatment'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 pt-4"
        >
          <form.Field
            name="treatmentName"
            validators={{
              onChange: ({ value }) =>
                !value?.trim() ? 'Treatment name is required' : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label>
                  Treatment Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g., Scaling & Polishing"
                />
                {field.state.meta.errors[0] && (
                  <p className="text-[11px] text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="cost"
              validators={{
                onChange: ({ value }) =>
                  value !== undefined && value < 0
                    ? 'Cost cannot be negative'
                    : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label>Cost (Rs.)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={field.state.value ?? ''}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                    placeholder="0"
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-[11px] text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="date"
              validators={{
                onChange: ({ value }) =>
                  !value ? 'Date is required' : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label>
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-[11px] text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          {!linkedMode && encounters.length > 0 && (
            <form.Field name="encounterId">
              {(field) => (
                <div className="space-y-2">
                  <Label>Link to Visit (optional)</Label>
                  <Select
                    value={field.state.value || 'none'}
                    onValueChange={(v) =>
                      field.handleChange(v === 'none' ? '' : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No visit (standalone)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No visit (standalone)</SelectItem>
                      {encounters.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {new Date(e.encounterDate).toLocaleDateString()}
                          {e.reason ? ` — ${e.reason}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          )}

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-20 resize-none"
                  placeholder="Clinical notes..."
                />
              </div>
            )}
          </form.Field>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.values.treatmentName] as const}
            >
              {([canSubmit, name]) => (
                <Button
                  type="submit"
                  disabled={isPending || !canSubmit || !name.trim()}
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Treatment
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
