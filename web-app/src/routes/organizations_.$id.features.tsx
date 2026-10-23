import { createFileRoute, Navigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/useAuthStore'
import { OrgFeatureEntitlements } from '@/features/feature-flags/components/OrgFeatureEntitlements'

export const Route = createFileRoute('/organizations_/$id/features')({
  component: FeatureManagementRoute,
})

function FeatureManagementRoute() {
  const { id } = Route.useParams()
  const { isSuperAdmin } = useAuthStore()

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />
  }

  return (
    <DashboardLayout
      title="Feature entitlement"
      subtitle="Entitled = in this clinic's plan (optionally a trial). Enabled = the clinic owner's switch."
      backTo="/organizations"
      backLabel="Back to organizations"
    >
      <OrgFeatureEntitlements orgId={id} />
    </DashboardLayout>
  )
}
