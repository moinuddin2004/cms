import { FlaskConical } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { useActiveLab } from '../hooks/useLabPortal'
import { LAB_ROLE_LABEL } from '../types'

/**
 * Which lab the portal works in. A picker when the user works in several
 * labs; otherwise just the lab's name. Every portal query is keyed by the
 * active lab, so switching never shows the previous lab's data.
 */
export function LabSwitcher() {
  const { labs, labId, membership, setActiveLab } = useActiveLab()

  if (labs.length <= 1) {
    return (
      <div className="flex h-[38px] items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-sm font-semibold">
        <FlaskConical className="size-4 text-primary" />
        <span className="max-w-48 truncate">{membership?.labName ?? '—'}</span>
      </div>
    )
  }

  return (
    <Select value={labId ?? undefined} onValueChange={setActiveLab}>
      <SelectTrigger className="h-[38px] w-60" aria-label="Switch lab">
        <FlaskConical className="size-4 text-primary" />
        <SelectValue placeholder="Choose a lab" />
      </SelectTrigger>
      <SelectContent align="end">
        {labs.map((l) => (
          <SelectItem key={l.labId} value={l.labId}>
            {l.labName}
            <span className="ml-1 text-xs text-text-3">
              · {LAB_ROLE_LABEL[l.role]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
