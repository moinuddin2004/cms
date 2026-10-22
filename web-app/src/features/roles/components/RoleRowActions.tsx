import { Copy, Trash2 } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import type { RoleSummary } from '../types/roles.types'

/** Clone + Delete (custom roles only) icon buttons for a role row / card. */
export function RoleRowActions({
  role,
  onClone,
  onDelete,
}: {
  role: RoleSummary
  onClone: (role: RoleSummary) => void
  onDelete: (role: RoleSummary) => void
}) {
  return (
    <div className="flex justify-end gap-1">
      <TooltipButton
        tooltip={`Clone ${role.name}`}
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={(e) => {
          e.stopPropagation()
          onClone(role)
        }}
      >
        <Copy className="size-4" />
      </TooltipButton>
      {!role.isSystemRole && (
        <TooltipButton
          tooltip={`Delete ${role.name}`}
          variant="ghost"
          size="icon"
          className="size-8 text-danger hover:text-danger"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(role)
          }}
        >
          <Trash2 className="size-4" />
        </TooltipButton>
      )}
    </div>
  )
}
