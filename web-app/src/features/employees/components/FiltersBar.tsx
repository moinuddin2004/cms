import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RotateCcw, Loader2 } from 'lucide-react'
import { EMPLOYMENT_TYPE_OPTIONS, STATUS_OPTIONS } from '../types'
import { useEmploymentRoles } from '../hooks/useEmploymentRoles'

interface FiltersBarProps {
  role: string
  onRoleChange: (value: string) => void
  employmentType: string
  onEmploymentTypeChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  onReset: () => void
}

export function FiltersBar({
  role,
  onRoleChange,
  employmentType,
  onEmploymentTypeChange,
  status,
  onStatusChange,
  onReset,
}: FiltersBarProps) {
  const { data: roles = [], isLoading: isLoadingRoles } = useEmploymentRoles()
  const hasActiveFilters = role || employmentType || status

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Role Filter */}
      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger
          className="w-[160px] h-8 text-xs"
          size="sm"
          aria-label="Filter by role"
          id="filter-role"
        >
          {isLoadingRoles ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <SelectValue placeholder="All Roles" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.slug}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>


      {/* Employment Type Filter */}
      <Select value={employmentType} onValueChange={onEmploymentTypeChange}>
        <SelectTrigger
          className="w-[140px] h-8 text-xs"
          size="sm"
          aria-label="Filter by employment type"
          id="filter-employment-type"
        >
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger
          className="w-[140px] h-8 text-xs"
          size="sm"
          aria-label="Filter by status"
          id="filter-status"
        >
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Reset filters"
          id="reset-filters"
        >
          <RotateCcw size={13} className="mr-1.5" />
          Reset
        </Button>
      )}
    </div>
  )
}
