import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { PrintLayoutsPage } from '@/features/prescriptions/pages/PrintLayoutsPage'

/** Print layouts (letterhead, footer, paper). */
export const Route = createFileRoute('/prescription-templates')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <PrintLayoutsPage />
    </RequireFeaturePage>
  ),
})
