import { useState } from 'react'
import { Loader2, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  useResetRules,
  useSendTestEmail,
} from '../hooks/useNotificationSettings'

/** Page-header actions: send a test email to me, reset every rule to defaults. */
export function NotificationSettingsActions() {
  const test = useSendTestEmail()
  const reset = useResetRules()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={test.isPending}
        onClick={() => test.mutate()}
      >
        {test.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        Send test email
      </Button>
      <Button
        variant="outline"
        disabled={reset.isPending}
        onClick={() => setConfirming(true)}
      >
        <RotateCcw className="size-4" /> Reset to defaults
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Reset notification rules?"
        description="Every event goes back to the default: in-app on, and email on only for the important events. Master switches, quiet hours and message wording stay as they are."
        confirmLabel="Reset"
        isLoading={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, { onSettled: () => setConfirming(false) })
        }
      />
    </div>
  )
}
