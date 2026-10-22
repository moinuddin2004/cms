import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { InventoryPage } from '@/features/inventory/pages/InventoryPage'

export const Route = createFileRoute('/inventory')({
  staticData: { can: 'inventory.view' },
  component: () => (
    <DashboardLayout>
      <InventoryPage />
    </DashboardLayout>
  ),
})
