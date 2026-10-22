import { createFileRoute } from '@tanstack/react-router'
import { ConsultationPage } from '@/features/consultation'

/** The doctor's full-screen working view for one patient in the chair. */
export const Route = createFileRoute('/consultation/$encounterId')({
  staticData: { can: 'consultation.conduct' },
  component: function ConsultationRoute() {
    const { encounterId } = Route.useParams()
    return <ConsultationPage encounterId={encounterId} />
  },
})
