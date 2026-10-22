import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { PERMISSIONS } from '@/features/access/generated/catalog'
import type {
  Permission,
  PermissionGroup,
  PermissionMap,
  Scope,
} from '@/features/access/generated/catalog'
import { cn } from '@/lib/utils'
import {
  applyLevel,
  BUNDLE_LEVELS,
  defaultGrant,
  isFeatureOff,
  LEVEL_LABEL,
  moduleLevel,
  permissionsOf,
  SCOPE_LABEL,
  scopesOf,
  setGrant,
} from '../lib/bundles'
import type { ModuleLevel } from '../types/roles.types'
import { HighRiskBadge } from './role-badges'

/**
 * One module: None / Basic / Full (and Custom when the grants match no
 * bundle), with an "Advanced" list of every permission and its scope.
 */
export function ModuleBundleRow({
  group,
  permissions,
  onChange,
  readOnly,
  hasFeature,
}: {
  group: PermissionGroup
  permissions: PermissionMap
  onChange: (next: PermissionMap) => void
  readOnly: boolean
  hasFeature: (feature: string) => boolean
}) {
  const [advanced, setAdvanced] = useState(false)
  const level = moduleLevel(group, permissions)
  const keys = permissionsOf(group)
  const allOff = keys.every((k) => isFeatureOff(k, hasFeature))
  const levels: ModuleLevel[] =
    level === 'custom' ? [...BUNDLE_LEVELS, 'custom'] : [...BUNDLE_LEVELS]

  return (
    <section
      aria-label={`${group} permissions`}
      className={cn(
        'border-b border-border last:border-b-0',
        allOff && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-[140px] flex-1">
          <h3 className="text-sm font-medium">{group}</h3>
          {allOff && <p className="text-xs text-text-3">Feature band hai</p>}
        </div>

        <div
          role="radiogroup"
          aria-label={`${group} level`}
          className="inline-flex rounded-lg border border-border bg-panel-2 p-0.5"
        >
          {levels.map((l) => {
            const active = l === level
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={readOnly || l === 'custom'}
                onClick={() =>
                  l !== 'custom' && onChange(applyLevel(group, permissions, l))
                }
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed',
                  active
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-text-3 hover:text-foreground disabled:hover:text-text-3',
                )}
              >
                {LEVEL_LABEL[l]}
              </button>
            )
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          aria-expanded={advanced}
          onClick={() => setAdvanced((v) => !v)}
        >
          Advanced
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              advanced && 'rotate-180',
            )}
          />
        </Button>
      </div>

      {advanced && (
        <ul className="space-y-1 bg-panel-2/50 px-4 pb-3 pt-1">
          {keys.map((key) => (
            <PermissionRow
              key={key}
              perm={key}
              permissions={permissions}
              onChange={onChange}
              readOnly={readOnly}
              featureOff={isFeatureOff(key, hasFeature)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function PermissionRow({
  perm,
  permissions,
  onChange,
  readOnly,
  featureOff,
}: {
  perm: Permission
  permissions: PermissionMap
  onChange: (next: PermissionMap) => void
  readOnly: boolean
  featureOff: boolean
}) {
  const def = PERMISSIONS[perm]
  const grant = permissions[perm]
  const scopes = scopesOf(perm)
  const id = `perm-${perm}`

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-md px-2 py-1.5',
        featureOff && 'opacity-60',
      )}
    >
      <Checkbox
        id={id}
        checked={grant !== undefined}
        disabled={readOnly}
        onCheckedChange={(checked) =>
          onChange(
            setGrant(
              permissions,
              perm,
              checked ? defaultGrant(perm) : undefined,
            ),
          )
        }
      />
      <label
        htmlFor={id}
        className="flex flex-1 flex-wrap items-center gap-2 text-sm"
      >
        {def.label}
        {def.risk === 'high' && <HighRiskBadge />}
        {featureOff && (
          <span className="text-xs text-text-3">Feature band hai</span>
        )}
      </label>
      {scopes.length > 0 && grant !== undefined && grant !== true && (
        <Select
          value={grant}
          disabled={readOnly}
          onValueChange={(v) =>
            onChange(setGrant(permissions, perm, v as Scope))
          }
        >
          <SelectTrigger className="h-8 w-36" aria-label={`${def.label} scope`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopes.map((s) => (
              <SelectItem key={s} value={s}>
                {SCOPE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </li>
  )
}
