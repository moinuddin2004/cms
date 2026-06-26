import type { ComponentType, ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** Empty list state — icon + message + optional call to action. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
        <Icon className="size-7" />
      </span>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-text-2">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
