import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Breadcrumb {
  label: string
  href?: string
}

interface PageWrapperProps {
  title: string
  subtitle?: string
  breadcrumbs?: Breadcrumb[]
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * Standard page shell: breadcrumbs + page header (title/subtitle/actions) + content.
 * Every dashboard page renders through this so titles/breadcrumbs stay consistent.
 */
export function PageWrapper({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  className,
}: PageWrapperProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[13px] text-text-3"
        >
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1
            return (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                {crumb.href && !isLast ? (
                  <Link
                    to={crumb.href}
                    className="transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={cn(isLast && 'font-medium text-text-2')}>
                    {crumb.label}
                  </span>
                )}
                {!isLast && <ChevronRight className="size-3.5 text-text-3" />}
              </span>
            )
          })}
        </nav>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-text-3">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {children}
    </div>
  )
}
