import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/useAuthStore';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" />;
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name || 'Administrator'}.
          </p>
        </div>

        {/* Placeholder cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Patients', value: '—', color: 'from-blue-500/10 to-blue-500/5' },
            { label: 'Appointments Today', value: '—', color: 'from-emerald-500/10 to-emerald-500/5' },
            { label: 'Revenue (Month)', value: '—', color: 'from-purple-500/10 to-purple-500/5' },
            { label: 'Active Staff', value: '—', color: 'from-orange-500/10 to-orange-500/5' },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border border-border/50 bg-gradient-to-br ${card.color} p-6 space-y-2`}
            >
              <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
