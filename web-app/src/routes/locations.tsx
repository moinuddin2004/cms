import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/locations')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/locations', replace: true })
  },
})
