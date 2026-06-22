import { createFileRoute, Navigate } from '@tanstack/react-router'

// Reports & analytics now live on the consolidated Dashboard.
export const Route = createFileRoute('/reports')({
  component: () => <Navigate to="/dashboard" replace />,
})
