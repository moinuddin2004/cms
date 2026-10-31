import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A titled block of settings. */
export function SettingsCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-xl border border-border bg-surface', className)}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-text-3">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

/** One setting: what it is on the left, the control on the right. */
export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-text-3">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
