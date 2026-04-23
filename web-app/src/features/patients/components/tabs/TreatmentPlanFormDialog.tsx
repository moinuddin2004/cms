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
      status: TreatmentPlanStatus.PROPOSED,
    },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) return
      mutate(
        {
          patientId,
          ...value,
          dentistId: user.uuid,
        },
        {
          onSuccess: () => setOpen(false),
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
      <DialogContent className="sm:max-w-[500px]">
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
          <form.Field name="planName">
            {(field) => (
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                  placeholder="e.g., Full Mouth Rehabilitation"
                />
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
            <form.Field name="estimatedCost">
              {(field) => (
                <div className="space-y-2">
                  <Label>Estimated Total Cost (Rs.)</Label>
                  <Input
                    type="number"
                    value={field.state.value || ''}
                    onChange={(e) =>
                      field.handleChange(Number(e.target.value) || undefined)
                    }
                    placeholder="0"
                  />
                </div>
              )}
            </form.Field>

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
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.state.values.planName}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Plan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
