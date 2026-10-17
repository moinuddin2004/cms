import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Billing's take on the project's layout pieces, so billing screens look
 * like Patients / Overview: compact filter card, bordered section headers
 * with an icon, small controls (h-8, text-xs).
 */

/** Card with a `border-b` header, icon + title (patient Overview style). */
export function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  flush,
  className,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  /** No inner padding — for tables that bring their own. */
  flush?: boolean
  className?: string
}) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            {Icon && <Icon size={16} className="text-brand-600" />}
            {title}
          </CardTitle>
          {description && (
            <p className="mt-0.5 text-xs text-text-3">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </CardHeader>
      <CardContent className={flush ? 'p-0' : 'p-4'}>{children}</CardContent>
    </Card>
  )
}

/** The compact filters row every listing has (Patients page style). */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card className="py-0">
      <CardContent className="flex flex-row flex-wrap items-center gap-3 p-2 px-3">
        {children}
      </CardContent>
    </Card>
  )
}

/** Debounced (300 ms) search box sized for the filter bar. */
export function FilterSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local)
    }, 300)
    return () => clearTimeout(t)
  }, [local, value, onChange])

  return (
    <div className="relative w-full max-w-sm">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        size={16}
      />
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 pl-9 pr-8 text-xs"
      />
      {local && (
        <button
          type="button"
          onClick={() => {
            setLocal('')
            onChange('')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/** "Reset" with the active-filter count, shown only when filters are on. */
export function ResetFilters({
  count,
  onReset,
}: {
  count: number
  onReset: () => void
}) {
  if (!count) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onReset}
      className="h-8 text-xs text-muted-foreground hover:text-foreground"
    >
      <RotateCcw size={13} className="mr-1" />
      Reset
      <Badge variant="muted" className="ml-1 px-1.5 py-0 text-[10px]">
        {count}
      </Badge>
    </Button>
  )
}

/** Muted label / value pair used in summary blocks. */
export function Stat({
  label,
  children,
  strong,
}: {
  label: string
  children: ReactNode
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-text-3">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          strong && 'font-semibold text-foreground',
        )}
      >
        {children}
      </span>
    </div>
  )
}

/** Heading above a standalone DataTable section (icon + title + actions). */
export function SectionHeading({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon && <Icon size={16} className="text-brand-600" />}
          {title}
        </h2>
        {description && <p className="text-xs text-text-3">{description}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
