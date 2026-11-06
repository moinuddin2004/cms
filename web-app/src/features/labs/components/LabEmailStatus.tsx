import { useState } from 'react'
import { BadgeCheck, Loader2, MailWarning, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useLabMutation } from '../hooks/useLabMutation'
import { labDirectoryApi } from '../services/labs.api'
import type { Lab } from '../types'

/**
 * Super admin: whether the lab's contact address is confirmed (order links are
 * emailed only then), with resend and "mark verified".
 */
export function LabEmailStatus({ lab }: { lab: Lab }) {
  const [confirming, setConfirming] = useState(false)
  const resend = useLabMutation(
    () => labDirectoryApi.resendEmailConfirmation(lab.id),
    {
      success: (r: { sent: boolean }) =>
        r.sent
          ? `Confirmation link sent to ${lab.email}`
          : 'The email could not be sent — check the SMTP settings',
    },
  )
  const verify = useLabMutation(
    () => labDirectoryApi.markEmailVerified(lab.id),
    {
      success: `${lab.email} is now verified`,
    },
  )

  if (!lab.email) return null
  if (lab.emailVerified) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <BadgeCheck className="size-3" /> Verified
      </Badge>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className="gap-1 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <MailWarning className="size-3" /> Not confirmed
      </Badge>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={resend.isPending}
        onClick={() => resend.mutate(undefined)}
      >
        {resend.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Send className="size-3.5" />
        )}
        Resend link
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={verify.isPending}
        onClick={() => setConfirming(true)}
      >
        <BadgeCheck className="size-3.5" /> Mark verified
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Mark the lab’s email as verified?"
        description={
          <>
            Order links and lab emails will go to <strong>{lab.email}</strong>.
            Do this only if you are sure the address belongs to {lab.name}.
          </>
        }
        confirmLabel="Mark verified"
        isLoading={verify.isPending}
        onConfirm={() =>
          verify.mutate(undefined, { onSettled: () => setConfirming(false) })
        }
      />
    </div>
  )
}
