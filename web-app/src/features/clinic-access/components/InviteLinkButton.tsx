import { useState } from 'react'
import { Check, Copy, Link2, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { formatDate } from '@/lib/datetime'
import { useAccess } from '@/features/access'
import {
  inviteUrl,
  useCreateInvite,
  useInvites,
  useRevokeInvite,
} from '../hooks/useInvites'
import type { ClinicInvite } from '../types'

/**
 * Employees header: "Invite link" — a link staff open to sign in with
 * Google and ask to join. Requests show under "Join requests", where the
 * role is chosen.
 */
export function InviteLinkButton() {
  const { can } = useAccess()
  const [open, setOpen] = useState(false)
  if (!can('employees.manage')) return null

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Link2 className="size-3.5" />
        Invite link
      </Button>
      <InviteLinkSheet open={open} onOpenChange={setOpen} />
    </>
  )
}

function InviteLinkSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const invites = useInvites(open)
  const create = useCreateInvite()
  const revoke = useRevokeInvite()
  const [revoking, setRevoking] = useState<ClinicInvite | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-[17px] font-bold">Invite link</SheetTitle>
          <SheetDescription className="text-[13px] text-text-3">
            Send this link to staff (e.g. on WhatsApp). They sign in with Google
            and send a request; you approve it under Join requests and choose
            their role. Links work for 7 days.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            Create invite link
          </Button>

          {invites.isLoading ? (
            <LoadingSkeleton variant="table" />
          ) : invites.isError ? (
            <ErrorState onRetry={() => void invites.refetch()} />
          ) : !invites.data?.length ? (
            <EmptyState
              icon={Link2}
              title="No open invite links"
              description="Create one and send it to the people you want to add."
            />
          ) : (
            <ul className="space-y-3">
              {invites.data.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  onRevoke={() => setRevoking(invite)}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Turn off this link?"
        description="People who open it will be told to ask for a new link. Requests already sent stay."
        confirmLabel="Turn off"
        destructive
        isLoading={revoke.isPending}
        onConfirm={() =>
          revoking &&
          revoke.mutate(revoking.id, { onSettled: () => setRevoking(null) })
        }
      />
    </Sheet>
  )
}

function InviteRow({
  invite,
  onRevoke,
}: {
  invite: ClinicInvite
  onRevoke: () => void
}) {
  const [copied, setCopied] = useState(false)
  const url = inviteUrl(invite.token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the link and copy it.')
    }
  }

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 rounded-md bg-panel-2 py-1 pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-foreground">
          {url}
        </span>
        <TooltipButton
          tooltip={copied ? 'Copied' : 'Copy link'}
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={copy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </TooltipButton>
        <TooltipButton
          tooltip="Turn off link"
          variant="ghost"
          size="icon"
          className="size-8 text-danger hover:text-danger"
          onClick={onRevoke}
        >
          <Trash2 className="size-4" />
        </TooltipButton>
      </div>
      <p className="mt-2 text-xs text-text-3">
        Works until {formatDate(invite.expiresAt)} · {invite.uses} request
        {invite.uses === 1 ? '' : 's'} sent
      </p>
    </li>
  )
}
