import { createFileRoute, Navigate } from '@tanstack/react-router'
import { AdminSubscriptionsPage } from '@/features/account'
import { useAuthStore } from '@/store/useAuthStore'

export const Route = createFileRoute('/subscriptions')({
  component: SubscriptionsRoute,
})

function SubscriptionsRoute() {
  const { isSuperAdmin } = useAuthStore()
  if (!isSuperAdmin) return <Navigate to="/dashboard" />
  return <AdminSubscriptionsPage />
}
