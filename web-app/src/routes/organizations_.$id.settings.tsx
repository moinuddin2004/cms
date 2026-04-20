import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OrganizationSettingsFeature } from '@/features/organizations/OrganizationSettingsFeature';
import { useAuthStore } from '@/store/useAuthStore';
import { Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/organizations_/$id/settings')({
  component: OrganizationSettingsRouteComponent,
});

function OrganizationSettingsRouteComponent() {
  const { id } = Route.useParams();
  const { isSuperAdmin } = useAuthStore();

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <DashboardLayout title="Organization Settings">
      <OrganizationSettingsFeature organizationId={id} />
    </DashboardLayout>
  );
}
