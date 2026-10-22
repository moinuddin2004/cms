import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PrescriptionBuilder } from '@/features/prescriptions'

const searchSchema = z.object({
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
})

export const Route = createFileRoute('/prescriptions/new')({
  staticData: { can: 'prescriptions.create' },
  validateSearch: searchSchema,
  component: () => <NewPrescriptionPage />,
})

function NewPrescriptionPage() {
  const { patientId, appointmentId } = Route.useSearch()
  return (
    <DashboardLayout
      title="New Prescription"
      backTo="/prescriptions"
      backLabel="Back to prescriptions"
    >
      <PrescriptionBuilder
        initialPatientId={patientId}
        initialAppointmentId={appointmentId}
      />
    </DashboardLayout>
  )
}
