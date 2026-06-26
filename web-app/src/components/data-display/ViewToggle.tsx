import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'table' | 'card'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
  size?: 'sm' | 'default'
}

/** Segmented control to switch between list (table) and card views. */
export function ViewToggle({ value, onChange, className, size = 'default' }: ViewToggleProps) {
  const isSm = size === 'sm'
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[9px] border border-border bg-panel',
        isSm ? 'p-[2px]' : 'p-[3px]',
        className,
      )}
      role="tablist"
      aria-label="View mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'table'}
        title="List view"
        onClick={() => onChange('table')}
        className={cn(
          'flex items-center justify-center rounded-[7px] transition-colors',
          isSm ? 'h-6 px-2 text-xs' : 'h-7 px-2.5',
          value === 'table'
            ? 'bg-surface text-foreground shadow-sm'
            : 'text-text-2 hover:text-foreground',
        )}
      >
        <List className={isSm ? 'size-3.5' : 'size-4'} />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'card'}
        title="Card view"
        onClick={() => onChange('card')}
        className={cn(
          'flex items-center justify-center rounded-[7px] transition-colors',
          isSm ? 'h-6 px-2 text-xs' : 'h-7 px-2.5',
          value === 'card'
            ? 'bg-surface text-foreground shadow-sm'
            : 'text-text-2 hover:text-foreground',
        )}
      >
        <LayoutGrid className={isSm ? 'size-3.5' : 'size-4'} />
      </button>
    </div>
  )
}
