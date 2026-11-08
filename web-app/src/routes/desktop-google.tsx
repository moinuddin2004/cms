import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DesktopGooglePage } from '@/features/auth/pages/DesktopGooglePage'

const searchSchema = z.object({
  state: z.string().optional(),
})

export const Route = createFileRoute('/desktop-google')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { state } = Route.useSearch()
  return <DesktopGooglePage state={state} />
}
