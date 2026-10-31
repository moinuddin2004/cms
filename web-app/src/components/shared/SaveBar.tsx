import { Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'

interface SaveBarProps {
  dirty: boolean
  saving: boolean
  canSave?: boolean
  onSave: () => void
  onDiscard: () => void
  saveLabel?: string
}

/**
 * Sticky "Unsaved changes · Discard / Save" bar for settings forms. Shows
 * only while the form is dirty and asks before the user leaves the page.
 */
export function SaveBar({
  dirty,
  saving,
  canSave = true,
  onSave,
  onDiscard,
  saveLabel = 'Save changes',
}: SaveBarProps) {
  const blocker = useUnsavedChangesGuard(dirty && !saving)

  return (
    <>
      {(dirty || saving) && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="sticky bottom-4 z-20 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">
              You have unsaved changes
            </p>
            <div className="flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscard}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={saving || !canSave}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {saving ? 'Saving…' : saveLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title="Leave without saving?"
        description="Your changes on this page haven't been saved and will be lost."
        confirmLabel="Leave"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  )
}
