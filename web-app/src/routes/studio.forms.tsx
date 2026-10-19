import { createFileRoute, Navigate } from '@tanstack/react-router'
import { FormSchemasPage } from '@/features/engine-studio'
import { useAuthStore } from '@/store/useAuthStore'

/** Configuration Studio: form schemas — super admins only. */
export const Route = createFileRoute('/studio/forms')({
  component: FormSchemasRoute,
})

function FormSchemasRoute() {
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <FormSchemasPage />
}
