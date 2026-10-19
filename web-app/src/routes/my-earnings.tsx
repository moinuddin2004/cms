import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { COMMISSIONS_FEATURE, MyEarningsPage } from '@/features/billing'

export const Route = createFileRoute('/my-earnings')({
  component: () => (
    <RequireFeaturePage feature={COMMISSIONS_FEATURE}>
      <RequireRolePage roles={['doctor']}>
        <DashboardLayout>
          <MyEarningsPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
