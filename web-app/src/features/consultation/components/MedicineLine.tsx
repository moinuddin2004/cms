import { Check, ChevronDown, Pill, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import {
  DURATION_PRESETS,
  FREQUENCY_PRESETS,
  MealRelation,
} from '@/features/prescriptions'
import type { PrescriptionMedicine } from '@/features/prescriptions'
import { Chip } from './Chip'

/** A medicine on the screen; `key` is only for React and is never sent. */
export type RxLine = PrescriptionMedicine & { key: string }

const MEALS: { label: string; value: MealRelation }[] = [
  { label: 'After meal', value: MealRelation.AFTER_MEAL },
  { label: 'Before meal', value: MealRelation.BEFORE_MEAL },
  { label: 'With meal', value: MealRelation.WITH_MEAL },
  { label: 'Empty stomach', value: MealRelation.EMPTY_STOMACH },
]

const MEAL_LABEL: Record<string, string> = Object.fromEntries(
  MEALS.map((m) => [m.value, m.label.toLowerCase()]),
)

/** The server needs dose, frequency and duration on every saved line. */
export function isLineComplete(l: RxLine): boolean {
  return (
    l.medicineName.trim() !== '' &&
    l.dosage.trim() !== '' &&
    l.frequency.trim() !== '' &&
    l.duration.trim() !== ''
  )
}

/**
 * One medicine on the prescription. Collapsed it is a one-line summary; opened
 * it shows tap-chips for frequency, duration and meal timing — no typing.
 */
export function MedicineLine({
  line,
  expanded,
  readOnly,
  onToggle,
  onChange,
  onRemove,
}: {
  line: RxLine
  expanded: boolean
  readOnly: boolean
  onToggle: () => void
  onChange: (patch: Partial<RxLine>) => void
  onRemove: () => void
}) {
  const complete = isLineComplete(line)

  return (
    <li
      className={cn(
        'rounded-lg border bg-surface',
        complete ? 'border-border' : 'border-amber/60 bg-amber-soft/30',
      )}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={readOnly}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Pill className="size-4 shrink-0 text-primary-text" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {line.medicineName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {complete
                ? [
                    line.dosage,
                    line.frequency,
                    line.duration,
                    MEAL_LABEL[line.mealRelation ?? ''],
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Choose frequency and duration'}
            </span>
          </span>
          {!readOnly && (
            <ChevronDown
              className={cn(
                'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
                expanded && 'rotate-180',
              )}
            />
          )}
        </button>
        {!readOnly && (
          <TooltipButton
            tooltip="Remove medicine"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </TooltipButton>
        )}
      </div>

      {expanded && !readOnly && (
        <div className="space-y-3 border-t border-border p-3">
          <Field label="Dose">
            <Input
              value={line.dosage}
              onChange={(e) => onChange({ dosage: e.target.value })}
              placeholder="e.g. 1 tablet, 5 ml"
              className="h-9 max-w-60"
            />
          </Field>
          <Field label="How often">
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_PRESETS.map((f) => (
                <Chip
                  key={f}
                  active={line.frequency === f}
                  onClick={() => onChange({ frequency: f })}
                >
                  {f}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="For how long">
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((d) => (
                <Chip
                  key={d}
                  active={line.duration === d}
                  onClick={() => onChange({ duration: d })}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="With food">
            <div className="flex flex-wrap gap-1.5">
              {MEALS.map((m) => (
                <Chip
                  key={m.value}
                  active={line.mealRelation === m.value}
                  onClick={() =>
                    onChange({
                      mealRelation:
                        line.mealRelation === m.value
                          ? MealRelation.NONE
                          : m.value,
                    })
                  }
                >
                  {m.label}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Note for this medicine (optional)">
            <Input
              value={line.specialInstructions ?? ''}
              onChange={(e) =>
                onChange({ specialInstructions: e.target.value })
              }
              placeholder="e.g. dissolve in water"
              className="h-9"
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            className="h-9"
            onClick={onToggle}
            disabled={!complete}
          >
            <Check className="size-4" /> Done
          </Button>
        </div>
      )}
    </li>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}
