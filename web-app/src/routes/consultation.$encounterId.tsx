import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { ConsultationPage } from '@/features/consultation'

/** The doctor's full-screen working view for one patient in the chair. */
export const Route = createFileRoute('/consultation/$encounterId')({
  component: function ConsultationRoute() {
    const { encounterId } = Route.useParams()
    return (
      <RequireFeaturePage feature="appointments.core">
        <ConsultationPage encounterId={encounterId} />
      </RequireFeaturePage>
    )
  },
})
