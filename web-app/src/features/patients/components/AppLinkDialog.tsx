import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Smartphone, Unlink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { QrCode } from '@/features/lab-orders'
import { formatDateTime, formatTime } from '@/lib/datetime'
import {
  useAppLinkStatus,
  useCreateClaimToken,
  useRevokeAppLink,
} from '../hooks/useAppLink'

/** Seconds left until `expiresAt` (the server's instant), ticking every second. */
function useCountdown(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAt) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])
  if (!expiresAt) return 0
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
}

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

interface Props {
  patientId: string
  patientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** QR claim code + link status for one patient (M2-05). The token is never persisted. */
export function AppLinkDialog({
  patientId,
  patientName,
  open,
  onOpenChange,
}: Props) {
  const status = useAppLinkStatus(patientId, open)
  const create = useCreateClaimToken(patientId)
  const revoke = useRevokeAppLink(patientId)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const claim = create.data
  const remaining = useCountdown(claim?.expiresAt)
  const expired = !!claim && remaining === 0
  const linked = status.data?.status === 'active'
  const { reset } = create

  // Forget the token as soon as the dialog closes or the patient gets linked.
  useEffect(() => {
    if (!open || linked) reset()
  }, [open, linked, reset])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link patient app</DialogTitle>
            <DialogDescription>
              Link {patientName} to their app account. The patient scans the
              code in the app.
            </DialogDescription>
          </DialogHeader>

          {status.isLoading ? (
            <LoadingSkeleton variant="detail" />
          ) : status.isError || !status.data ? (
            <ErrorState
              title="Couldn't load link status"
              onRetry={() => void status.refetch()}
            />
          ) : linked && status.data.link ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/10">
                  Linked
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {status.data.link.maskedEmail ?? 'App account'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Linked {formatDateTime(status.data.link.linkedAt)} ·{' '}
                {status.data.link.relation}
              </p>
              <Button
                variant="destructive"
                onClick={() => setConfirmRevoke(true)}
                disabled={revoke.isPending}
              >
                {revoke.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unlink className="size-4" />
                )}
                Revoke link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Not linked</Badge>
                <TooltipButton
                  tooltip="Refresh status"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => void status.refetch()}
                >
                  <RefreshCw
                    className={`size-4 ${status.isFetching ? 'animate-spin' : ''}`}
                  />
                </TooltipButton>
              </div>

              {claim && !expired ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-lg border border-border bg-white p-3">
                    <QrCode
                      value={claim.url}
                      size={220}
                      label="Patient app link code"
                    />
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    Expires in {mmss(remaining)}
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      (at {formatTime(claim.expiresAt)})
                    </span>
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    Single use. Anyone holding this code can claim the record
                    until it expires — show it only to the patient.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Smartphone className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {expired
                      ? 'The code expired. Generate a new one.'
                      : 'Generate a one-time code valid for 15 minutes.'}
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                variant={claim && !expired ? 'outline' : 'default'}
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {claim ? 'Regenerate code' : 'Generate code'}
              </Button>
              {status.data.pendingClaim && !claim && (
                <p className="text-center text-xs text-muted-foreground">
                  A code is already pending until{' '}
                  {formatTime(status.data.pendingClaim.expiresAt)}. Generating a
                  new one replaces it.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Revoke app link?"
        description="The patient's app account will lose access to this clinic record. They can be linked again later."
        confirmLabel="Revoke"
        destructive
        isLoading={revoke.isPending}
        onConfirm={() =>
          revoke.mutate(undefined, { onSettled: () => setConfirmRevoke(false) })
        }
      />
    </>
  )
}
