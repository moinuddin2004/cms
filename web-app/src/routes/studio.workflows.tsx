import { createFileRoute, Navigate } from '@tanstack/react-router'
import { WorkflowsPage } from '@/features/engine-studio'
import { useAuthStore } from '@/store/useAuthStore'

/** Configuration Studio: workflows — super admins only. */
export const Route = createFileRoute('/studio/workflows')({
  component: WorkflowsRoute,
})

function WorkflowsRoute() {
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <WorkflowsPage />
}
