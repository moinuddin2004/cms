import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OrganizationManagementView } from '@/features/organizations/OrganizationManagementView';
import { useAuthStore } from '@/store/useAuthStore';
import { Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/organizations')({
  component: OrganizationsRouteComponent,
});

function OrganizationsRouteComponent() {
  const { isSuperAdmin } = useAuthStore();

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <DashboardLayout title="Organizations Management">
      <div className="space-y-4">
        <OrganizationManagementView />
      </div>
    </DashboardLayout>
  );
}
