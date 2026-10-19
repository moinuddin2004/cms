import {
  History,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipButton } from '@/components/shared/TooltipButton'
import type { LabLink, LabLinkAction } from '../types'

export interface LinkActionHandlers {
  onEdit: (link: LabLink) => void
  onHistory: (link: LabLink) => void
  onSuspend: (link: LabLink) => void
  onTransition: (
    link: LabLink,
    action: Exclude<LabLinkAction, 'suspend'>,
  ) => void
  /** Id of the link whose status change is in flight. */
  pendingId: string | null
}

/** Three-dot menu for one lab on the clinic's list. */
export function LabLinkActions({
  link,
  onEdit,
  onHistory,
  onSuspend,
  onTransition,
  pendingId,
}: LinkActionHandlers & { link: LabLink }) {
  const pending = pendingId === link.id
  const labActive = link.lab.status === 'active'

  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TooltipButton
            tooltip={`Actions for ${link.lab.name}`}
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </TooltipButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(link)}>
            <Pencil className="size-4" /> Edit terms
          </DropdownMenuItem>
          {link.status === 'invited' && (
            <DropdownMenuItem
              disabled={!labActive}
              onClick={() => onTransition(link, 'activate')}
            >
              <Play className="size-4" /> Activate
            </DropdownMenuItem>
          )}
          {link.status === 'suspended' && (
            <DropdownMenuItem
              disabled={!labActive}
              onClick={() => onTransition(link, 'reactivate')}
            >
              <Play className="size-4" /> Reactivate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onHistory(link)}>
            <History className="size-4" /> History
          </DropdownMenuItem>
          {link.status !== 'suspended' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onSuspend(link)}
              >
                <Pause className="size-4" /> Suspend
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
