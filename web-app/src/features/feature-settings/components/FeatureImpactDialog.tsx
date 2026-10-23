import { Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useFeatureImpact } from '../hooks/useFeatureSettings'
import type { OwnerFeature } from '../types/feature-settings.types'

/**
 * Confirm before switching a feature off, listing the permissions that stop
 * working and the roles that lose them.
 */
export function FeatureImpactDialog({
  feature,
  onOpenChange,
  onConfirm,
  isLoading,
}: {
  feature: OwnerFeature | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isLoading: boolean
}) {
  const impact = useFeatureImpact(feature?.key ?? null)

  const body = impact.isLoading ? (
    <span className="flex items-center gap-2">
      <Loader2 className="size-4 animate-spin" /> Checking what this affects…
    </span>
  ) : impact.isError ? (
    <span>Could not load what this affects. You can still turn it off.</span>
  ) : impact.data ? (
    <span className="block space-y-3" data-testid="feature-impact">
      <span className="block">
        Staff lose these permissions everywhere in the clinic until you turn it
        back on. Roles keep their settings, so turning it on again restores
        access exactly as it was.
      </span>
      {impact.data.permissions.length > 0 && (
        <span className="block">
          <span className="block font-medium text-foreground">
            Permissions that stop working
          </span>
          <span className="mt-1 block">
            {impact.data.permissions.map((p) => p.label).join(', ')}
          </span>
        </span>
      )}
      <span className="block">
        <span className="block font-medium text-foreground">
          Roles affected
        </span>
        <span className="mt-1 block">
          {impact.data.roles.length
            ? impact.data.roles.map((r) => r.name).join(', ')
            : 'No role uses this feature.'}
        </span>
      </span>
    </span>
  ) : null

  return (
    <ConfirmDialog
      open={!!feature}
      onOpenChange={onOpenChange}
      title={feature ? `Turn off ${feature.name}?` : 'Turn off feature?'}
      description={body}
      confirmLabel="Turn off"
      destructive
      isLoading={isLoading}
      onConfirm={onConfirm}
    />
  )
}
