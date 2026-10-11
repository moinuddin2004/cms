import { Pill } from 'lucide-react'
import type { PrescriptionMedicine } from '../types'

/** First few medicine names as soft chips, with a "+N" overflow chip. */
export function MedicineChips({
  medicines,
  max = 2,
}: {
  medicines: PrescriptionMedicine[] | undefined
  max?: number
}) {
  const list = medicines ?? []
  if (list.length === 0) {
    return <span className="text-xs text-text-3">No medicines</span>
  }
  const shown = list.slice(0, max)
  const rest = list.length - shown.length

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((m, i) => (
        <span
          key={m.id ?? `${m.medicineName}-${i}`}
          className="inline-flex max-w-[160px] items-center gap-1 rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium text-text-2"
        >
          <Pill className="size-3 shrink-0 text-primary-text" />
          <span className="truncate">{m.medicineName}</span>
        </span>
      ))}
      {rest > 0 && (
        <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary-text">
          +{rest}
        </span>
      )}
    </div>
  )
}
