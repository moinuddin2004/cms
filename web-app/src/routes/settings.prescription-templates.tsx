import { createFileRoute } from '@tanstack/react-router'
import { PrintLayoutsPage } from '@/features/prescriptions/pages/PrintLayoutsPage'

/** Print layouts (letterhead, footer, paper). */
export const Route = createFileRoute('/settings/prescription-templates')({
  staticData: { can: ['prescriptions.create', 'prescriptions.library.manage'] },
  component: PrintLayoutsPage,
})
