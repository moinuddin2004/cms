import { useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A compact tap target (32px tall) used for every quick pick on the
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
        'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
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

/**
 * A row of chips that shows the first `limit` options plus any already chosen
 * ones, with a "+N more" chip to reveal the rest — so a long pick list never
 * turns into a wall of buttons.
 */
export function ChipGroup<T>({
  items,
  getKey,
  getLabel,
  isActive,
  onPick,
  limit = 6,
  trailing,
  className,
}: {
  items: T[]
  getKey: (item: T) => string
  getLabel: (item: T) => ReactNode
  isActive: (item: T) => boolean
  onPick: (item: T) => void
  limit?: number
  /** Always-visible chip(s) after the options, e.g. "Other…". */
  trailing?: ReactNode
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const hidden = expanded
    ? []
    : items.filter((item, i) => i >= limit && !isActive(item))
  const shown = items.filter((item) => !hidden.includes(item))

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((item) => (
        <Chip
          key={getKey(item)}
          active={isActive(item)}
          onClick={() => onPick(item)}
        >
          {getLabel(item)}
        </Chip>
      ))}
      {trailing}
      {items.length > limit && (hidden.length > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="inline-flex h-8 items-center rounded-full px-2.5 text-[13px] font-medium text-primary-text hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? 'Show less' : `+${hidden.length} more`}
        </button>
      )}
    </div>
  )
}
