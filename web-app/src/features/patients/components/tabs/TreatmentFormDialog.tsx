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
import { DatePicker } from '@/components/shared/DatePicker'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { Loader2, Plus } from 'lucide-react'
import { usePatientHistory } from '../../hooks/usePatientSubEntities'
import { useTreatmentForm } from '../../hooks/useTreatmentForm'
import { usePlanTemplates } from '@/features/plan-templates'
import { formatDate } from '@/lib/datetime'

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
  const linkedMode = !!encounterId

  // Standalone mode lets the user optionally attach the treatment to a visit.
  const { data: history } = usePatientHistory(linkedMode ? '' : patientId)
  const encounters = history?.encounters ?? []

  // Plans are defined on the Treatment Plans page; here they are only picked.
  const { data: allPlans = [] } = usePlanTemplates()
  const plans = allPlans.filter((p) => p.isActive)
  // Which procedure of the picked plan this treatment is ('' = whole plan).
  const [procedure, setProcedure] = useState('')

  const { form, isPending, applyPlan } = useTreatmentForm({
    patientId,
    encounterId,
    onSaved: () => {
      setProcedure('')
      setOpen(false)
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
          <form.Field name="planTemplateId">
            {(field) => {
              const plan = plans.find((p) => p.id === field.state.value)
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Treatment plan</Label>
                    <Select
                      value={field.state.value || 'none'}
                      onValueChange={(v) => {
                        const id = v === 'none' ? '' : v
                        field.handleChange(id)
                        setProcedure('')
                        applyPlan(
                          plans.find((p) => p.id === id),
                          '',
                        )
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No plan</SelectItem>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Procedure</Label>
                    <Select
                      value={procedure || 'all'}
                      disabled={!plan || plan.items.length === 0}
                      onValueChange={(v) => {
                        const item = v === 'all' ? '' : v
                        setProcedure(item)
                        applyPlan(plan, item)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Whole plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Whole plan</SelectItem>
                        {(plan?.items ?? []).map((item, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {item.procedureName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )
            }}
          </form.Field>

          <form.Field name="treatmentName">
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
                {fieldError(field) && (
                  <p className="text-xs font-medium text-danger">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="cost">
              {(field) => (
                <div className="space-y-2">
                  <Label>Cost (Rs.)</Label>
                  <NumberInput
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="0"
                  />
                  {fieldError(field) && (
                    <p className="text-xs font-medium text-danger">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="date">
              {(field) => (
                <div className="space-y-2">
                  <Label>
                    Date <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    value={field.state.value}
                    onChange={(v) => {
                      field.handleChange(v)
                      field.handleBlur()
                    }}
                  />
                  {fieldError(field) && (
                    <p className="text-xs font-medium text-danger">
                      {fieldError(field)}
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
                      <SelectItem value="none">
                        No visit (standalone)
                      </SelectItem>
                      {encounters.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {formatDate(e.encounterDate)}
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
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || isPending}
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
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
