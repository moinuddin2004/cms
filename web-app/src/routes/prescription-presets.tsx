import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/prescription-presets')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/prescription-presets', replace: true })
  },
})
