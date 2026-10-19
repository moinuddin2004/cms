import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { COMMISSIONS_FEATURE, DoctorEarningsPage } from '@/features/billing'

export const Route = createFileRoute('/billing/doctor-earnings')({
  component: () => (
    <RequireFeaturePage feature={COMMISSIONS_FEATURE}>
      <RequireRolePage roles={['clinic_admin']}>
        <DashboardLayout>
          <DoctorEarningsPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
