import { createFileRoute } from '@tanstack/react-router'
import { DisplayPage } from '@/features/queue'

/** Waiting-room TV: public, full screen, no dashboard chrome. */
export const Route = createFileRoute('/display/$locationId')({
  component: function DisplayRoute() {
    const { locationId } = Route.useParams()
    return <DisplayPage locationId={locationId} />
  },
})
