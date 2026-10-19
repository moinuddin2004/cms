import { createFileRoute, Navigate } from '@tanstack/react-router'
import { LabDetailPage } from '@/features/labs'
import { useAuthStore } from '@/store/useAuthStore'

/** One platform lab — super admins only. */
export const Route = createFileRoute('/lab-directory_/$labId')({
  component: LabDetailRoute,
})

function LabDetailRoute() {
  const { labId } = Route.useParams()
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <LabDetailPage labId={labId} />
}
