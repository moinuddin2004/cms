import { createFileRoute } from '@tanstack/react-router'
import { LabLinksPage } from '@/features/labs'

/** The clinic's lab list. */
export const Route = createFileRoute('/labs')({
  staticData: { can: 'lab.links.manage' },
  component: () => <LabLinksPage />,
})
