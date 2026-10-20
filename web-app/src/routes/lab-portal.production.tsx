import { createFileRoute } from '@tanstack/react-router'
import { LabProductionPage } from '@/features/lab-portal'

/** The lab's production desk: work queue, shipments, remakes. */
export const Route = createFileRoute('/lab-portal/production')({
  component: LabProductionPage,
})
