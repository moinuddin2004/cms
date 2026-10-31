import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/admin/theme')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/theme', replace: true })
  },
})
