import { useNavigate } from '@tanstack/react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PatientForm } from './PatientForm'
import { useCreatePatient } from '../hooks/useCreatePatient'
import type { PatientFormData } from '../types'
import { usePatientStore } from '@/store/patient-store'

interface CreatePatientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePatientModal({
  open,
  onOpenChange,
}: CreatePatientModalProps) {
  const navigate = useNavigate()
  const createMutation = useCreatePatient()
  const clearFormDraft = usePatientStore((s) => s.clearFormDraft)

  const handleSubmit = async (data: PatientFormData) => {
    const newPatient = await createMutation.mutateAsync(data)
    onOpenChange(false)
    if (newPatient?.id) {
      navigate({
        to: '/patients/$patientId',
        params: { patientId: newPatient.id },
      })
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        clearFormDraft()
      }
      onOpenChange(v)
    }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Patient</DialogTitle>
          <DialogDescription>
            Fill in patient details across all steps, then save.
          </DialogDescription>
        </DialogHeader>
        <PatientForm
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending}
          mode="create"
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  )
}
