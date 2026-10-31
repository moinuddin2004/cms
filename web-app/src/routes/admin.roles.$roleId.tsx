import { createFileRoute, redirect } from '@tanstack/react-router'

/** Moved to Settings: kept so old links and bookmarks still land. */
export const Route = createFileRoute('/admin/roles/$roleId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/settings/roles/$roleId',
      params: { roleId: params.roleId },
      replace: true,
    })
  },
})
