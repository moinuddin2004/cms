import { useState } from 'react'
import { TooltipButton } from '@/components/shared/TooltipButton'
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
import { useForm } from '@tanstack/react-form'
import { useCreatePrescription } from '../../hooks/usePatientSubEntities'
import { useAuthStore } from '@/store/useAuthStore'
import { Loader2, Plus, Trash2 } from 'lucide-react'

export function PrescriptionFormDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useCreatePrescription()
  const { user } = useAuthStore()

  const [medications, setMedications] = useState<
    { name: string; dosage: string; frequency: string; instructions: string }[]
  >([{ name: '', dosage: '', frequency: '', instructions: '' }])

  const form = useForm({
    defaultValues: {
      chiefComplaint: '',
      diagnosis: '',
      specialInstructions: '',
    },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) return
      const validMeds = medications.filter((m) => m.name.trim() !== '')
      if (validMeds.length === 0) return // At least one medication needed

      mutate(
        {
          patientId,
          ...value,
          prescribedBy: user.uuid,
          medications: validMeds,
        },
        {
          onSuccess: () => setOpen(false),
        },
      )
    },
  })

  const addMed = () =>
    setMedications([
      ...medications,
      { name: '', dosage: '', frequency: '', instructions: '' },
    ])
  const removeMed = (index: number) => {
    const newMeds = [...medications]
    newMeds.splice(index, 1)
    setMedications(newMeds)
  }
  const updateMed = (index: number, field: string, value: string) => {
    const newMeds = [...medications]
    newMeds[index] = { ...newMeds[index], [field]: value }
    setMedications(newMeds)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New Rx</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Prescription</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 pt-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="chiefComplaint">
              {(field) => (
                <div className="space-y-2">
                  <Label>Chief Complaint</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="diagnosis">
              {(field) => (
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Medications</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMed}
              >
                <Plus size={14} className="mr-1" /> Add Medicine
              </Button>
            </div>

            {medications.map((med, idx) => (
              <div
                key={idx}
                className="p-3 border rounded-md space-y-3 bg-muted/20"
              >
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold">
                    Medicine #{idx + 1}
                  </Label>
                  {medications.length > 1 && (
                    <TooltipButton
                      tooltip="Remove medicine"
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-700"
                      onClick={() => removeMed(idx)}
                    >
                      <Trash2 size={14} />
                    </TooltipButton>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1 space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={med.name}
                      onChange={(e) => updateMed(idx, 'name', e.target.value)}
                      required
                      placeholder="Amoxicillin 500mg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dosage</Label>
                    <Input
                      value={med.dosage}
                      onChange={(e) => updateMed(idx, 'dosage', e.target.value)}
                      placeholder="1 tab"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Frequency</Label>
                    <Input
                      value={med.frequency}
                      onChange={(e) =>
                        updateMed(idx, 'frequency', e.target.value)
                      }
                      placeholder="TDS (1-1-1)"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Instructions</Label>
                    <Input
                      value={med.instructions}
                      onChange={(e) =>
                        updateMed(idx, 'instructions', e.target.value)
                      }
                      placeholder="After meals"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form.Field name="specialInstructions">
            {(field) => (
              <div className="space-y-2 pt-2 border-t">
                <Label>General Special Instructions</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-20 resize-none"
                  placeholder="e.g., Avoid cold water..."
                />
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
            <Button
              type="submit"
              disabled={isPending || medications[0].name.trim() === ''}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Prescription
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
