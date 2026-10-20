import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { useLabLinks } from '@/features/labs'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/lab-payables', label: 'Bills' },
  { to: '/lab-payables/payments', label: 'Payments' },
  { to: '/lab-payables/statements', label: 'Statements' },
  { to: '/lab-payables/reports', label: 'Reports' },
] as const

/** Switches between the payables pages. */
export function PayablesNav({
  active,
}: {
  active: (typeof TABS)[number]['to']
}) {
  return (
    <nav
      className="flex gap-1 border-b border-border"
      aria-label="Lab payables"
    >
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            t.to === active
              ? 'border-primary text-foreground'
              : 'border-transparent text-text-3 hover:text-foreground',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

export const ALL = 'all'

/** The clinic's labs (any link status — old bills keep their lab). */
export function useClinicLabs(): Array<[string, string]> {
  const { data } = useLabLinks({ page: 1, limit: 100 })
  return useMemo(
    () =>
      (data?.data ?? []).map((l) => [l.lab.id, l.lab.name] as [string, string]),
    [data],
  )
}

export function LabFilter({
  value,
  onChange,
  labs,
}: {
  value: string
  onChange: (v: string) => void
  labs: Array<[string, string]>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-44" aria-label="Filter by lab">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All labs</SelectItem>
        {labs.map(([id, name]) => (
          <SelectItem key={id} value={id}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
