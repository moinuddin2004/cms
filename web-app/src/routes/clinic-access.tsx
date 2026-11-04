import { createFileRoute } from '@tanstack/react-router'
import { ClinicAccessPage } from '@/features/auth/pages/ClinicAccessPage'

export const Route = createFileRoute('/clinic-access')({
  component: ClinicAccessPage,
})
