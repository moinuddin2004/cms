import { Check, Loader2, Pause, Play } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import type { PortalClinic, PortalLinkAction } from '../types'

export interface ClinicActionHandlers {
  onSuspend: (link: PortalClinic) => void
  onTransition: (
    link: PortalClinic,
    action: Exclude<PortalLinkAction, 'suspend'>,
  ) => void
  /** Id of the link whose status change is in flight. */
  pendingId: string | null
  /** Only lab admins change links. */
  canManage: boolean
}

/**
 * The lab's side of a clinic link: accept an invitation, suspend, or
 * reactivate. At most two actions apply at once, so they are icon buttons.
 */
export function PortalClinicActions({
  link,
  onSuspend,
  onTransition,
  pendingId,
  canManage,
}: ClinicActionHandlers & { link: PortalClinic }) {
  if (!canManage) return null
  const name = link.clinic.name

  if (pendingId === link.id) {
    return (
      <div className="flex justify-end">
        <Loader2
          className="m-2 size-4 animate-spin text-text-3"
          aria-label="Saving"
        />
      </div>
    )
  }

  return (
    <div
      className="flex justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {link.status === 'invited' && (
        <TooltipButton
          tooltip={`Accept ${name}`}
          variant="ghost"
          size="icon"
          className="size-8 text-emerald"
          onClick={() => onTransition(link, 'activate')}
        >
          <Check className="size-4" />
        </TooltipButton>
      )}
      {link.status === 'suspended' && (
        <TooltipButton
          tooltip={`Reactivate ${name}`}
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onTransition(link, 'reactivate')}
        >
          <Play className="size-4" />
        </TooltipButton>
      )}
      {link.status !== 'suspended' && (
        <TooltipButton
          tooltip={
            link.status === 'invited' ? `Decline ${name}` : `Suspend ${name}`
          }
          variant="ghost"
          size="icon"
          className="size-8 text-danger"
          onClick={() => onSuspend(link)}
        >
          <Pause className="size-4" />
        </TooltipButton>
      )}
    </div>
  )
}
