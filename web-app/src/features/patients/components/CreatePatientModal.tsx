import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useState } from 'react'
import { PatientForm } from './PatientForm'
import { AddAppointmentStep } from './AddAppointmentStep'
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
  const createMutation = useCreatePatient()
  const clearFormDraft = usePatientStore((s) => s.clearFormDraft)

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

  const isAppointmentStep = !!createdPatient

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className="w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto gap-0 p-0">
        {!isAppointmentStep && (
          <DialogTitle className="sr-only">New Patient</DialogTitle>
        )}
        {isAppointmentStep && (
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="text-[17px] font-bold">
              Book First Appointment
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Patient added! Book an appointment now or skip to do it later.
            </DialogDescription>
          </DialogHeader>
        )}

        <div className="px-6 py-5">
          {!isAppointmentStep ? (
            <PatientForm
              onSubmit={handlePatientSubmit}
              isSubmitting={createMutation.isPending}
              mode="create"
              onCancel={handleClose}
            />
          ) : (
            <AddAppointmentStep
              patientId={createdPatient.id}
              patientName={createdPatient.fullName}
              onSkip={handleClose}
              onDone={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
