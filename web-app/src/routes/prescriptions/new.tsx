import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PrescriptionBuilder } from '@/features/prescriptions'

const searchSchema = z.object({
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
})

export const Route = createFileRoute('/prescriptions/new')({
  validateSearch: searchSchema,
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <NewPrescriptionPage />
    </RequireFeaturePage>
  ),
})

function NewPrescriptionPage() {
  const { patientId, appointmentId } = Route.useSearch()
  return (
    <DashboardLayout title="New Prescription">
      <PrescriptionBuilder
        initialPatientId={patientId}
        initialAppointmentId={appointmentId}
      />
    </DashboardLayout>
  )
}
