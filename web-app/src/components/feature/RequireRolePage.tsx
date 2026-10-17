import type { ReactNode } from 'react'
import { Loader2, ShieldOff } from 'lucide-react'
import { useQueueRole } from '@/features/queue/hooks/useQueueRole'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'

export type ClinicRole = 'clinic_admin' | 'receptionist' | 'doctor'

/** True when the signed-in user holds any of `roles` at the active location. */
export function useHasClinicRole(roles: ClinicRole[]): {
  allowed: boolean
  isLoading: boolean
} {
  const { isLoading, isAdmin, canReception, canDoctor } = useQueueRole()
  const allowed = roles.some((r) =>
    r === 'clinic_admin'
      ? isAdmin
      : r === 'receptionist'
        ? canReception
        : canDoctor,
  )
  return { allowed, isLoading }
}

/**
 * Route-level role guard, mirroring RequireFeaturePage. The API enforces
 * the same roles; this only keeps restricted pages from rendering.
 */
export function RequireRolePage({
  roles,
  children,
}: {
  roles: ClinicRole[]
  children: ReactNode
}) {
  const { allowed, isLoading } = useHasClinicRole(roles)

  if (isLoading) {
    return (
      <DashboardLayout title="Loading">
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }
  if (allowed) return <>{children}</>

  return (
    <DashboardLayout title="Not available">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldOff className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            You don’t have access to this page
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ask a clinic admin if you need it.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
