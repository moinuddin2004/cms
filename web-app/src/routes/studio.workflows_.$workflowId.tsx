import { createFileRoute, Navigate } from '@tanstack/react-router'
import { WorkflowDetailPage } from '@/features/engine-studio'
import { useAuthStore } from '@/store/useAuthStore'

/** One workflow template in the Configuration Studio — super admins only. */
export const Route = createFileRoute('/studio/workflows_/$workflowId')({
  component: WorkflowDetailRoute,
})

function WorkflowDetailRoute() {
  const { workflowId } = Route.useParams()
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <WorkflowDetailPage workflowId={workflowId} />
}
