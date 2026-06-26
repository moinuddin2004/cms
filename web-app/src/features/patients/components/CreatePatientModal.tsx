import { useNavigate } from '@tanstack/react-router'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) clearFormDraft()
        onOpenChange(v)
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border-soft px-6 py-5">
          <SheetTitle className="text-[17px] font-bold">New Patient</SheetTitle>
          <SheetDescription className="text-[13px] text-text-3">
            Fill in patient details across all steps, then save.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <PatientForm
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
            mode="create"
            onCancel={handleCancel}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
