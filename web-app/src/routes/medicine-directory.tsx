import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/medicine-directory')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/medicine-directory', replace: true })
  },
})
