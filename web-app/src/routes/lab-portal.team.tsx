import { createFileRoute } from '@tanstack/react-router'
import { LabTeamPage } from '@/features/lab-portal'

/** The lab's team — lab admins manage it. */
export const Route = createFileRoute('/lab-portal/team')({
  component: LabTeamPage,
})
