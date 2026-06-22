import { createFileRoute, Navigate } from '@tanstack/react-router'

// Financial summary is now consolidated into the Dashboard.
export const Route = createFileRoute('/financial-summary')({
  component: () => <Navigate to="/dashboard" replace />,
})
