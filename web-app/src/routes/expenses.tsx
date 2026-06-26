import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ExpensesPage } from '@/features/billing/pages/ExpensesPage'

export const Route = createFileRoute('/expenses')({
  component: () => (
    <RequireFeaturePage feature="billing.expenses">
      <DashboardLayout>
        <ExpensesPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
