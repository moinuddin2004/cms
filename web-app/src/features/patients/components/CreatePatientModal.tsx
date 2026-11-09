import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useState } from 'react'
import { PatientForm } from './PatientForm'
import { AddAppointmentStep } from './AddAppointmentStep'
import { useCreatePatient } from '../hooks/useCreatePatient'
import { FORM_STEPS  } from '../types'
import type {PatientFormData} from '../types';
import { usePatientStore } from '@/store/patient-store'

interface CreatePatientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePatientModal({
  open,
  onOpenChange,
}: CreatePatientModalProps) {
  const createMutation = useCreatePatient()
  const { clearFormDraft, setCurrentStep } = usePatientStore()

  const [createdPatient, setCreatedPatient] = useState<{
    id: string
    fullName: string
  } | null>(null)

  const handlePatientSubmit = async (data: PatientFormData) => {
    const newPatient = await createMutation.mutateAsync(data)
    if (newPatient?.id) {
      setCreatedPatient({ id: newPatient.id, fullName: newPatient.fullName })
    }
  }

  const handleClose = () => {
    clearFormDraft()
    setCreatedPatient(null)
    onOpenChange(false)
  }

  const handleBack = () => {
    setCurrentStep(FORM_STEPS.length - 1)
    setCreatedPatient(null)
  }

  const isAppointmentStep = !!createdPatient

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className="w-full sm:max-w-7xl max-h-[92vh] overflow-y-auto gap-0 p-0">
        <DialogTitle className="sr-only">
          {isAppointmentStep ? 'Book First Appointment' : 'New Patient'}
        </DialogTitle>

        {/* pr-12 keeps content clear of the absolute-positioned close button */}
        <div className="px-6 py-5 pr-12">
          {!isAppointmentStep ? (
            <PatientForm
              onSubmit={handlePatientSubmit}
              isSubmitting={createMutation.isPending}
              mode="create"
              onCancel={handleClose}
            />
          ) : (
            <div className="mx-auto max-w-3xl">
              <AddAppointmentStep
                patientId={createdPatient.id}
                patientName={createdPatient.fullName}
                onBack={handleBack}
                onSkip={handleClose}
                onDone={handleClose}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
