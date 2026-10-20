import { createFileRoute } from '@tanstack/react-router'
import { LabPortalOrdersPage } from '@/features/lab-portal'

/** The lab's order inbox. */
export const Route = createFileRoute('/lab-portal/orders')({
  component: LabPortalOrdersPage,
})
