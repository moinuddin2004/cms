import { createFileRoute } from '@tanstack/react-router'
import { LabPortalDashboardPage } from '@/features/lab-portal'

/** Lab portal home — lab staff only (no clinic context). */
export const Route = createFileRoute('/lab-portal/')({
  component: LabPortalDashboardPage,
})
