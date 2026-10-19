import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { useAuthStore } from '@/store/useAuthStore'
import { useSpecialties } from '../hooks/useFormSchemas'
import { ALL } from '../hooks/useStudioListFilters'
import { PLATFORM } from '../schemas/studio.schema'
import { ENTITY_TYPE_LABEL, WORKFLOW_ENTITY_TYPES } from '../types'

export function SpecialtyFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const specialties = useSpecialties()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-40" aria-label="Filter by specialty">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All specialties</SelectItem>
        {(specialties.data ?? []).map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Platform defaults only, one organization's forks, or everything. */
export function OwnerFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const organizations = useAuthStore((s) => s.accessibleOrganizations)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-44" aria-label="Filter by owner">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All owners</SelectItem>
        <SelectItem value={PLATFORM}>Platform defaults</SelectItem>
        {organizations.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function EntityTypeFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-36" aria-label="Filter by entity">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All entities</SelectItem>
        {WORKFLOW_ENTITY_TYPES.map((t) => (
          <SelectItem key={t} value={t}>
            {ENTITY_TYPE_LABEL[t]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
