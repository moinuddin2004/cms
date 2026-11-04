import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PatientsPage } from '@/features/patients/pages/PatientsPage'

export const Route = createFileRoute('/patients/')({
  staticData: { can: 'patients.view' },
  // Quick search links: `?search=` prefills the filter, `?create=1` opens
  // the new-patient form. The page applies them once and clears the URL.
  validateSearch: (
    search: Record<string, unknown>,
  ): { search?: string; create?: '1' } => ({
    search: typeof search.search === 'string' ? search.search : undefined,
    create: search.create === '1' ? '1' : undefined,
  }),
  component: () => (
    <DashboardLayout>
      <PatientsPage />
    </DashboardLayout>
  ),
})
