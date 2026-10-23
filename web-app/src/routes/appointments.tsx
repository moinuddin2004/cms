import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AppointmentsPage } from '@/features/appointments/pages/AppointmentsPage'

export const Route = createFileRoute('/appointments')({
  // Bookings or the reception queue board (any-of).
  staticData: { can: ['appointments.view', 'queue.board.view'] },
  validateSearch: (search: Record<string, unknown>) => ({
    create: search.create === '1' ? ('1' as const) : undefined,
  }),
  component: () => (
    <DashboardLayout>
      <AppointmentsPage />
    </DashboardLayout>
  ),
})
