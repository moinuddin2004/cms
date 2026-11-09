import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatInClinic } from '@/lib/datetime'
import type { SaveState } from '../types'

/** Tiny "Saving… / Saved 12:03" indicator for an auto-saving section. */
export function SaveBadge({
  state,
  savedAt,
}: {
  state: SaveState
  savedAt: Date | null
}) {
  if (state === 'idle' && !savedAt) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        state === 'error' ? 'text-destructive' : 'text-muted-foreground',
      )}
      aria-live="polite"
    >
      {state === 'saving' && <Loader2 className="size-3.5 animate-spin" />}
      {state === 'error' && <AlertCircle className="size-3.5" />}
      {(state === 'saved' || state === 'idle') && (
        <Check className="size-3.5 text-emerald" />
      )}
      {state === 'saving'
        ? 'Saving…'
        : state === 'error'
          ? 'Not saved — will retry'
          : `Saved${savedAt ? ` ${formatInClinic(savedAt, 'hh:mm a')}` : ''}`}
    </span>
  )
}
