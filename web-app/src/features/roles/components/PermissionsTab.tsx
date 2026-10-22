import { PERMISSION_GROUPS } from '@/features/access/generated/catalog'
import type { PermissionMap } from '@/features/access/generated/catalog'
import { ModuleBundleRow } from './ModuleBundleRow'

/** Every module as a bundle row (None / Basic / Full / Custom + Advanced). */
export function PermissionsTab({
  permissions,
  onChange,
  readOnly,
  hasFeature,
}: {
  permissions: PermissionMap
  onChange: (next: PermissionMap) => void
  readOnly: boolean
  hasFeature: (feature: string) => boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {PERMISSION_GROUPS.map((group) => (
        <ModuleBundleRow
          key={group}
          group={group}
          permissions={permissions}
          onChange={onChange}
          readOnly={readOnly}
          hasFeature={hasFeature}
        />
      ))}
    </div>
  )
}
