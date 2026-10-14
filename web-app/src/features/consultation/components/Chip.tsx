import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A finger-sized tap target (40px tall) used for every quick pick on the
 * consultation screen — phrases, frequencies, durations, follow-up dates.
 */
export function Chip({
  children,
  active,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  active?: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        active
          ? 'border-primary bg-primary-soft text-primary-text'
          : 'border-border bg-surface text-foreground hover:bg-panel',
        className,
      )}
    >
      {children}
    </button>
  )
}
