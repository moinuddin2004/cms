import type { ReactNode } from 'react'
import { Search, X, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
} from '../types'

export interface AppointmentFiltersProps {
  searchInput: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  type: string
  onTypeChange: (value: string) => void
  hasActiveFilters: boolean
  onReset: () => void
  /** Optional total count shown on the right. */
  count?: number
  /** Optional date controls (presets / custom range) — List view only.
   *  Rendered right after the search box. */
  dateControls?: ReactNode
}

/** The shared search + status + type + reset controls used inside the
 *  AppointmentsToolbar `filters` slot across Queue / List / Calendar. */
export function AppointmentFilters({
  searchInput,
  onSearchChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  hasActiveFilters,
  onReset,
  count,
  dateControls,
}: AppointmentFiltersProps) {
  return (
    <>
      {/* Search */}
      <div className="relative min-w-[200px] flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search appointments..."
          className="h-8 pl-9 pr-9 text-xs"
        />
        {searchInput && (
          <button
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-accent"
            type="button"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {dateControls}

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-8 w-[130px] text-xs" size="sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {APPOINTMENT_STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="h-8 w-[120px] text-xs" size="sm">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {APPOINTMENT_TYPE_OPTIONS.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={13} className="mr-1.5" />
          Reset
        </Button>
      )}

      {typeof count === 'number' && count > 0 && (
        <div className="ml-auto text-xs text-muted-foreground">
          {count} appointment{count === 1 ? '' : 's'}
        </div>
      )}
    </>
  )
}

/** Case-insensitive match of a search query against an appointment's
 *  patient name, phone and token — shared client-side filter helper. */
export function matchesAppointmentSearch(
  appt: {
    patient?: { fullName?: string; phone?: string } | null
    tokenNumber?: number | null
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = appt.patient?.fullName?.toLowerCase() ?? ''
  const phone = appt.patient?.phone?.toLowerCase() ?? ''
  const token = appt.tokenNumber != null ? `#${appt.tokenNumber}` : ''
  return name.includes(q) || phone.includes(q) || token.includes(q)
}
