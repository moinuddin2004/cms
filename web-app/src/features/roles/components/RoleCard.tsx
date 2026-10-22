import { Home, Users } from 'lucide-react'
import { bundleSummaryText } from '../lib/bundles'
import type { RoleSummary } from '../types/roles.types'
import { RoleDot, RoleKindBadge } from './role-badges'
import { RoleRowActions } from './RoleRowActions'

/** A role in the roles listing, card view. */
export function RoleCard({
  role,
  onOpen,
  onClone,
  onDelete,
}: {
  role: RoleSummary
  onOpen: (role: RoleSummary) => void
  onClone: (role: RoleSummary) => void
  onDelete: (role: RoleSummary) => void
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(role)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(role)}
      className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
            <RoleDot seed={role.id} />
            {role.name}
          </h2>
          <div className="mt-1.5">
            <RoleKindBadge isSystemRole={role.isSystemRole} />
          </div>
        </div>
        <RoleRowActions role={role} onClone={onClone} onDelete={onDelete} />
      </div>

      {role.description && (
        <p className="line-clamp-2 text-xs text-text-3">{role.description}</p>
      )}

      <p className="text-xs text-text-2">
        {bundleSummaryText(role.permissions)}
      </p>

      <div className="mt-auto flex items-center gap-4 border-t border-border pt-3 text-xs text-text-3">
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" />
          {role.memberCount} member{role.memberCount === 1 ? '' : 's'}
        </span>
        {role.homeRoute && (
          <span className="flex items-center gap-1.5 truncate">
            <Home className="size-3.5" />
            {role.homeRoute}
          </span>
        )}
      </div>
    </article>
  )
}
