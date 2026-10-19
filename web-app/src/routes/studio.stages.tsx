import { createFileRoute, Navigate } from '@tanstack/react-router'
import { StageTemplatesPage } from '@/features/engine-studio'
import { useAuthStore } from '@/store/useAuthStore'

/** Configuration Studio: stage templates — super admins only. */
export const Route = createFileRoute('/studio/stages')({
  component: StageTemplatesRoute,
})

function StageTemplatesRoute() {
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <StageTemplatesPage />
}
