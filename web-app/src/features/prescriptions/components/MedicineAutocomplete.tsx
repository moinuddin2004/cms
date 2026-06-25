import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMedicineSearch } from '../hooks/useMedicineDirectory'
import type { MedicineDirectoryItem, PrescriptionMedicine } from '../types'
import { MealRelation } from '../types'

interface MedicineAutocompleteProps {
  value: string
  onChange: (value: string) => void
  /** Called when the user picks an item — caller fills defaults from this. */
  onPick: (med: MedicineDirectoryItem) => void
  placeholder?: string
  className?: string
}

/**
 * Free-text input with a dropdown of matching medicine-directory rows.
 * Typing < 2 chars shows nothing; the parent keeps whatever the doctor typed
 * (free text is allowed — picking is optional).
 */
export function MedicineAutocomplete({
  value,
  onChange,
  onPick,
  placeholder = 'Type medicine name…',
  className,
}: MedicineAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { data: results = [], isFetching } = useMedicineSearch(value)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    setActiveIdx(0)
  }, [results])

  const pick = (m: MedicineDirectoryItem) => {
    onPick(m)
    onChange(m.name)
    setOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="pl-8 h-9"
        />
        {isFetching && value.length >= 2 && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && value.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {isFetching
                ? 'Searching…'
                : 'No matches. Press Enter to use as custom name.'}
            </div>
          ) : (
            results.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors flex items-start justify-between gap-2',
                  idx === activeIdx ? 'bg-accent' : 'hover:bg-accent/60',
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[m.genericName, m.strength, m.manufacturer]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-0.5 shrink-0">
                  {m.type.toLowerCase()}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Translates a picked directory item into the defaults the builder seeds into
 * a fresh medicine line.
 */
export function medicineFromDirectory(
  m: MedicineDirectoryItem,
): PrescriptionMedicine {
  return {
    medicineDirectoryId: m.id,
    medicineName: m.name,
    medicineNameUrdu: m.nameUrdu,
    type: m.type,
    dosage: m.defaultDosage ?? '1',
    frequency: m.defaultFrequency ?? '',
    frequencyTiming: [],
    mealRelation: m.defaultMealRelation ?? MealRelation.NONE,
    duration: m.defaultDuration ?? '',
    specialInstructions: null,
    specialInstructionsUrdu: m.instructionsUrdu,
  }
}
