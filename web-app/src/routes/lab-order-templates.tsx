import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { OrderTemplatesPage } from '@/features/lab-catalog'

/** Saved lab orders — every clinic role (doctors keep their own). */
export const Route = createFileRoute('/lab-order-templates')({
  component: () => (
    <RequireFeaturePage feature="dental.lab_orders">
      <OrderTemplatesPage />
    </RequireFeaturePage>
  ),
})
