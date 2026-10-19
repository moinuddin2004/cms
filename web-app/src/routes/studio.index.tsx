import { createFileRoute, Navigate } from '@tanstack/react-router'

/** /studio opens the first Configuration Studio screen. */
export const Route = createFileRoute('/studio/')({
  component: () => <Navigate to="/studio/forms" replace />,
})
