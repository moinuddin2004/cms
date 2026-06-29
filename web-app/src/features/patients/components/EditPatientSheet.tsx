import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PatientForm } from './PatientForm'
import { useUpdatePatient } from '../hooks/useUpdatePatient'
import { usePatientStore } from '@/store/patient-store'
import type { Patient, PatientFormData } from '../types'

interface EditPatientSheetProps {
  patient: Patient
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPatientSheet({
  patient,
  open,
  onOpenChange,
}: EditPatientSheetProps) {
  const updateMutation = useUpdatePatient(patient.id)
  const { clearFormDraft } = usePatientStore()

  const handleSubmit = async (data: PatientFormData) => {
    await updateMutation.mutateAsync(data)
    clearFormDraft()
    onOpenChange(false)
  }

  const handleCancel = () => {
    clearFormDraft()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Edit Patient</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-5">
          <PatientForm
            defaultValues={patient}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            mode="edit"
            onCancel={handleCancel}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
