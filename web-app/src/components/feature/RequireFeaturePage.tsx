import type { ReactNode } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { useFeatures } from '@/context/FeatureFlagsContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Route-level feature guard. Renders the page only when the org has the
 * feature enabled; otherwise shows a "not available" page so a disabled
 * feature can't be reached via a direct URL. While the org's flags are still
 * loading we show a spinner to avoid flashing the unavailable state.
 */
export function RequireFeaturePage({
  feature,
  children,
}: {
  feature: string
  children: ReactNode
}) {
  const { features, isLoading } = useFeatures()

  if (isLoading) {
    return (
      <DashboardLayout title="Loading">
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (features.has(feature)) return <>{children}</>

  return (
    <DashboardLayout title="Feature not available">
      <Card>
        <CardContent className="flex flex-col items-center justify-center text-center py-16">
          <Lock className="h-10 w-10 mb-4 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            This feature isn’t enabled
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            This feature isn’t enabled for your organization. Contact your
            administrator to turn it on.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
