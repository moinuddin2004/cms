import { createFileRoute } from '@tanstack/react-router'
import { ClinicProfilePage } from '@/features/account'

/** Owner only: the page itself tells everyone else. */
export const Route = createFileRoute('/settings/clinic')({
  component: ClinicProfilePage,
})
