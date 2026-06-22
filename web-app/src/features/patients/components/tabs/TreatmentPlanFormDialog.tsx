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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useCreateTreatmentPlan } from '../../hooks/usePatientSubEntities'
import { useAuthStore } from '@/store/useAuthStore'
import { Loader2, Plus } from 'lucide-react'
import { TreatmentPlanStatus } from '../../types'

export function TreatmentPlanFormDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useCreateTreatmentPlan()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues: {
      planName: '',
      description: '',
      estimatedCost: undefined as number | undefined,
      discountAmount: undefined as number | undefined,
      status: TreatmentPlanStatus.PROPOSED,
      startDate: '',
      expectedEndDate: '',
    },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) {
        toast.error('Your session is missing — please sign in again.')
        return
      }
      mutate(
        {
          patientId,
          dentistId: user.uuid,
          planName: value.planName.trim(),
          description: value.description || undefined,
          estimatedCost: value.estimatedCost,
          discountAmount: value.discountAmount,
          status: value.status,
          startDate: value.startDate || undefined,
          expectedEndDate: value.expectedEndDate || undefined,
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
        <Button size="sm">
          <Plus className="mr-2" size={16} /> New Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create Treatment Plan</DialogTitle>
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
            name="planName"
            validators={{
              onChange: ({ value }) =>
                !value?.trim() ? 'Plan name is required' : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label>
                  Plan Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="e.g., Full Mouth Rehabilitation"
                />
                {field.state.meta.errors[0] && (
                  <p className="text-[11px] text-destructive">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-20 resize-none"
                  placeholder="Plan details..."
                />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="estimatedCost"
              validators={{
                onChange: ({ value }) =>
                  value !== undefined && value < 0
                    ? 'Cost cannot be negative'
                    : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label>Estimated Cost (Rs.)</Label>
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
              name="discountAmount"
              validators={{
                onChangeListenTo: ['estimatedCost'],
                onChange: ({ value, fieldApi }) => {
                  if (value === undefined) return undefined
                  if (value < 0) return 'Discount cannot be negative'
                  const cost = fieldApi.form.getFieldValue('estimatedCost')
                  if (cost !== undefined && value > cost)
                    return 'Discount exceeds cost'
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label>Discount (Rs.)</Label>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="startDate">
              {(field) => (
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field
              name="expectedEndDate"
              validators={{
                onChangeListenTo: ['startDate'],
                onChange: ({ value, fieldApi }) => {
                  const start = fieldApi.form.getFieldValue('startDate')
                  if (value && start && value < start)
                    return 'End date is before start date'
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label>Expected End</Label>
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

          <form.Field name="status">
            {(field) => (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) =>
                    field.handleChange(v as TreatmentPlanStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TreatmentPlanStatus).map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.values.planName] as const}
            >
              {([canSubmit, planName]) => (
                <Button
                  type="submit"
                  disabled={isPending || !canSubmit || !planName.trim()}
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Plan
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
