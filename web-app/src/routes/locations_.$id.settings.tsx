import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/locations_/$id/settings')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/settings/locations/$id',
      params: { id: params.id },
      replace: true,
    })
  },
})
