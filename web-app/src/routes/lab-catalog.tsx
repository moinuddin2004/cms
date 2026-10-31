import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/lab-catalog')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/lab-catalog', replace: true })
  },
})
