import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/labs')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/labs', replace: true })
  },
})
