import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/useAuthStore';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SessionManagement } from '@/features/auth/components/SessionManagement';

export const Route = createFileRoute('/sessions')({
  component: RouteComponent,
});

function RouteComponent() {
  const { accessToken } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" />;
  }

  return (
    <DashboardLayout title="Active Sessions">
      <div className="max-w-4xl mx-auto">
        <SessionManagement />
      </div>
    </DashboardLayout>
  );
}
