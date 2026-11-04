import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCheck, Loader2, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotificationPrefs,
  useMyNotifications,
  useUnreadNotificationCount,
  useUpdateMyNotificationPrefs,
} from '../hooks/useMyNotifications'
import { useNotificationSocket } from '../hooks/useNotificationSocket'
import type { MyNotification } from '../types'

/**
 * Header bell: unread badge + the latest in-app notifications. Also owns the
 * realtime socket (instant badge, toast, chime) — one bell per shell.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  useNotificationSocket()
  const unread = useUnreadNotificationCount()
  const count = unread.data?.count ?? 0
  const label = count ? `Notifications (${count} unread)` : 'Notifications'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={label}
                className="relative size-[38px] rounded-[9px] border-border bg-surface text-text-2 hover:bg-panel hover:text-foreground"
              >
                <Bell className="size-[18px]" />
                {count > 0 && (
                  <span
                    data-testid="unread-badge"
                    className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-primary-foreground"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        align="end"
        className="w-[min(360px,calc(100vw-2rem))] p-0"
      >
        <NotificationList
          open={open}
          hasUnread={count > 0}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

function NotificationList({
  open,
  hasUnread,
  onNavigate,
}: {
  open: boolean
  hasUnread: boolean
  onNavigate: () => void
}) {
  const list = useMyNotifications(open)
  const markAll = useMarkAllNotificationsRead()
  const markRead = useMarkNotificationRead()
  const navigate = useNavigate()

  const openItem = (n: MyNotification) => {
    if (!n.readAt) markRead.mutate(n.id)
    if (n.link) {
      onNavigate()
      void navigate({ to: n.link })
    }
  }

  return (
    <div className="flex max-h-[460px] flex-col">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Notifications</h3>
        <div className="flex items-center gap-1">
          <SoundToggle />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={!hasUnread || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {markAll.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            Mark all read
          </Button>
        </div>
      </div>

      <div className="overflow-y-auto">
        {list.isLoading ? (
          <div className="space-y-3 p-4" aria-label="Loading notifications">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-text-2">Couldn’t load notifications.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void list.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : !list.data?.data.length ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-text">
              <Bell className="size-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              You’re all caught up
            </p>
            <p className="mt-1 text-xs text-text-3">
              Updates about lab orders and your patients appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-soft">
            {list.data.data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-panel',
                    !n.readAt && 'bg-primary-soft/40',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      n.readAt ? 'bg-transparent' : 'bg-primary',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {n.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-text-2">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-text-3">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                      })}
                      {!n.readAt && <span className="sr-only"> · unread</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Speaker switch for the chime; saved on the user, mirrored in this browser. */
function SoundToggle() {
  const prefs = useMyNotificationPrefs()
  const update = useUpdateMyNotificationPrefs()
  const on = prefs.data?.sound ?? true
  return (
    <TooltipButton
      tooltip={on ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
      tooltipSide="bottom"
      variant="ghost"
      size="icon"
      className="size-7"
      aria-pressed={on}
      disabled={update.isPending}
      onClick={() => update.mutate({ sound: !on })}
    >
      {update.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : on ? (
        <Volume2 className="size-3.5" />
      ) : (
        <VolumeX className="size-3.5" />
      )}
    </TooltipButton>
  )
}
