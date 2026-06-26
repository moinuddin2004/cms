import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { InventoryPage } from '@/features/inventory/pages/InventoryPage'

export const Route = createFileRoute('/inventory')({
  component: () => (
    <RequireFeaturePage feature="inventory.core">
      <DashboardLayout>
        <InventoryPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
