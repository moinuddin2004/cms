import { createFileRoute } from '@tanstack/react-router';
import { UserManagementView } from '@/features/users/UserManagementView';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const Route = createFileRoute('/users')({
  component: UserRouteComponent,
});

function UserRouteComponent() {
  return (
    <DashboardLayout title="User Management">
      <div className="space-y-4">
        <UserManagementView />
      </div>
    </DashboardLayout>
  );
}
