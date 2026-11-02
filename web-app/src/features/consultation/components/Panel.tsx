import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The one card shape every block on the consultation screen uses: a compact
 * header row (icon, title, optional badge, right-hand action) over the body,
 * and an optional footer that stays put while a height-capped body scrolls.
 */
export function Panel({
  icon,
  title,
  badge,
  action,
  footer,
  children,
  className,
  bodyClassName,
}: {
  icon: ReactNode
  title: string
  badge?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm',
        className,
      )}
    >
      <header className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="shrink-0 text-primary-text [&_svg]:size-4">
            {icon}
          </span>
          <span className="truncate">{title}</span>
          {badge}
        </h2>
        {action && <div className="flex shrink-0 items-center">{action}</div>}
      </header>
      <div className={cn('min-h-0 p-4', bodyClassName)}>{children}</div>
      {footer && (
        <footer className="shrink-0 border-t border-border bg-card px-4 py-3">
          {footer}
        </footer>
      )}
    </section>
  )
}

/** Small rounded count / status pill for a panel header. */
export function PanelBadge({
  children,
  tone = 'primary',
}: {
  children: ReactNode
  tone?: 'primary' | 'success' | 'warning'
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone === 'primary' && 'bg-primary-soft text-primary-text',
        tone === 'success' && 'bg-emerald-soft text-emerald',
        tone === 'warning' && 'bg-amber-soft text-amber',
      )}
    >
      {children}
    </span>
  )
}
