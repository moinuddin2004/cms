import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { EMPLOYMENT_TYPE_OPTIONS, STATUS_OPTIONS } from '../types'

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
  const hasActiveFilters = role || employmentType || status

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Role Filter */}
      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger
          className="w-[140px] h-9"
          aria-label="Filter by role"
          id="filter-role"
        >
          <SelectValue placeholder="All Roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dentist">Dentist</SelectItem>
          <SelectItem value="receptionist">Receptionist</SelectItem>
          <SelectItem value="assistant">Assistant</SelectItem>
          <SelectItem value="hygienist">Hygienist</SelectItem>
        </SelectContent>
      </Select>

      {/* Employment Type Filter */}
      <Select value={employmentType} onValueChange={onEmploymentTypeChange}>
        <SelectTrigger
          className="w-[140px] h-9"
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
          className="w-[140px] h-9"
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
          className="h-9 text-muted-foreground hover:text-foreground"
          aria-label="Reset filters"
          id="reset-filters"
        >
          <RotateCcw size={14} className="mr-1.5" />
          Reset
        </Button>
      )}
    </div>
  )
}
