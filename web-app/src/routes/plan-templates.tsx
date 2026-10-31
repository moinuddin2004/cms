import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/plan-templates')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/plan-templates', replace: true })
  },
})
