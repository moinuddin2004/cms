import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { GENDER_OPTIONS, BLOOD_GROUP_OPTIONS } from '../types'

interface FiltersBarProps {
  gender: string
  onGenderChange: (value: string) => void
  bloodGroup: string
  onBloodGroupChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  onReset: () => void
}

export function FiltersBar({
  gender,
  onGenderChange,
  bloodGroup,
  onBloodGroupChange,
  status,
  onStatusChange,
  onReset,
}: FiltersBarProps) {
  const hasActiveFilters = gender || bloodGroup || status

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Gender Filter */}
      <Select value={gender} onValueChange={onGenderChange}>
        <SelectTrigger
          className="w-[140px] h-8 text-xs"
          size="sm"
          aria-label="Filter by gender"
          id="filter-gender"
        >
          <SelectValue placeholder="Gender" />
        </SelectTrigger>
        <SelectContent>
          {GENDER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Blood Group Filter */}
      <Select value={bloodGroup} onValueChange={onBloodGroupChange}>
        <SelectTrigger
          className="w-[140px] h-8 text-xs"
          size="sm"
          aria-label="Filter by blood group"
          id="filter-blood-group"
        >
          <SelectValue placeholder="Blood Group" />
        </SelectTrigger>
        <SelectContent>
          {BLOOD_GROUP_OPTIONS.map((opt) => (
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
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
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
