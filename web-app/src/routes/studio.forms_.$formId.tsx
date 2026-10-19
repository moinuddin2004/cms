import { createFileRoute, Navigate } from '@tanstack/react-router'
import { FormSchemaDetailPage } from '@/features/engine-studio'
import { useAuthStore } from '@/store/useAuthStore'

/** One form schema in the Configuration Studio — super admins only. */
export const Route = createFileRoute('/studio/forms_/$formId')({
  component: FormSchemaDetailRoute,
})

function FormSchemaDetailRoute() {
  const { formId } = Route.useParams()
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <FormSchemaDetailPage formId={formId} />
}
