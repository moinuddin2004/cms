import { createFileRoute } from '@tanstack/react-router'
import { LabClinicsPage } from '@/features/lab-portal'

/** Clinics linked to the lab. */
export const Route = createFileRoute('/lab-portal/clinics')({
  component: LabClinicsPage,
})
