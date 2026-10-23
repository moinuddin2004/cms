import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ExpensesPage } from '@/features/billing/pages/ExpensesPage'

export const Route = createFileRoute('/expenses')({
  staticData: { can: 'expenses.view' },
  component: () => (
    <DashboardLayout>
      <ExpensesPage />
    </DashboardLayout>
  ),
})
