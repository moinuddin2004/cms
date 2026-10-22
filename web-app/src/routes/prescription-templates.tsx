import { createFileRoute } from '@tanstack/react-router'
import { PrintLayoutsPage } from '@/features/prescriptions/pages/PrintLayoutsPage'

/** Print layouts (letterhead, footer, paper). */
export const Route = createFileRoute('/prescription-templates')({
  // Doctors read the library; managers edit it.
  staticData: { can: ['prescriptions.create', 'prescriptions.library.manage'] },
  component: () => <PrintLayoutsPage />,
})
