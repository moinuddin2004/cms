import { createFileRoute } from '@tanstack/react-router'
import { LabProfilePage } from '@/features/lab-portal'

/** The lab's own profile. */
export const Route = createFileRoute('/lab-portal/profile')({
  component: LabProfilePage,
})
