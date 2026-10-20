import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { LabOrdersPage } from '@/features/lab-orders'

/** The clinic's lab orders — every clinic role. */
export const Route = createFileRoute('/lab-orders')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <LabOrdersPage />
    </RequireFeaturePage>
  ),
})
