import { createFileRoute, Navigate } from '@tanstack/react-router'
import { LabDirectoryPage } from '@/features/labs'
import { useAuthStore } from '@/store/useAuthStore'

/** Platform lab directory — super admins only. */
export const Route = createFileRoute('/lab-directory')({
  component: LabDirectoryRoute,
})

function LabDirectoryRoute() {
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <LabDirectoryPage />
}
