import { useState } from 'react'
import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { fdiRows, readTeeth } from '../lib/form-preview'
import { TOOTH_ROLES, TOOTH_SURFACES } from '../types'
import type { FieldDef, ToothAnswer, ToothRole } from '../types'

/**
 * FDI tooth chart: click teeth to pick them, then set each tooth's role
 * (crown / abutment / pontic / implant) and, when the field allows it, the
 * surfaces. The answer is `[{ tooth, role, surfaces? }]`, the shape the
 * server validator expects.
 */
export function ToothChartInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: unknown
  onChange: (value: ToothAnswer[]) => void
}) {
  const allowed = field.dentition ?? 'any'
  const [dentition, setDentition] = useState<'permanent' | 'primary'>(
    allowed === 'primary' ? 'primary' : 'permanent',
  )
  const roles: readonly ToothRole[] = field.roles?.length
    ? field.roles
    : TOOTH_ROLES
  const teeth = readTeeth(value)
  const picked = new Map(teeth.map((t) => [t.tooth, t]))
  const rows = fdiRows(dentition)

  const toggle = (tooth: string) =>
    onChange(
      picked.has(tooth)
        ? teeth.filter((t) => t.tooth !== tooth)
        : [...teeth, { tooth, role: roles[0] }],
    )
  const update = (tooth: string, patch: Partial<ToothAnswer>) =>
    onChange(teeth.map((t) => (t.tooth === tooth ? { ...t, ...patch } : t)))

  const toothButton = (tooth: string) => {
    const t = picked.get(tooth)
    return (
      <button
        key={tooth}
        type="button"
        aria-pressed={!!t}
        aria-label={`Tooth ${tooth}`}
        onClick={() => toggle(tooth)}
        className={cn(
          'flex h-9 w-7 flex-col items-center justify-center rounded-md border text-[11px] font-medium tabular-nums transition-colors',
          t
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card hover:bg-accent',
        )}
      >
        {tooth}
        {t?.role && roles.length > 1 && (
          <span className="text-[8px] uppercase leading-none opacity-80">
            {t.role.slice(0, 3)}
          </span>
        )}
      </button>
    )
  }

  const arch = (quadrants: string[][]) => (
    <div className="flex justify-center gap-2">
      {quadrants.map((q, i) => (
        <div
          key={i}
          className={cn(
            'flex gap-0.5',
            i === 0 && 'border-r border-border pr-2',
          )}
        >
          {q.map(toothButton)}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {allowed === 'any' && (
        <div className="flex gap-1" role="group" aria-label="Dentition">
          {(['permanent', 'primary'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dentition === d}
              onClick={() => setDentition(d)}
              className={cn(
                'rounded-md px-2 py-1 text-xs capitalize',
                dentition === d
                  ? 'bg-primary-soft text-primary-text'
                  : 'text-text-3 hover:bg-accent',
              )}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1 overflow-x-auto">
        <p className="text-center text-[10px] uppercase text-text-3">Upper</p>
        {arch(rows.upper)}
        <div className="mx-auto my-1 w-3/4 border-t border-dashed border-border" />
        {arch(rows.lower)}
        <p className="text-center text-[10px] uppercase text-text-3">Lower</p>
      </div>

      {teeth.length > 0 && (
        <ul className="space-y-2">
          {teeth.map((t) => (
            <li
              key={t.tooth}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="w-8 font-medium tabular-nums">{t.tooth}</span>
              {roles.length > 1 ? (
                <Select
                  value={t.role ?? roles[0]}
                  onValueChange={(v) =>
                    update(t.tooth, { role: v as ToothRole })
                  }
                >
                  <SelectTrigger
                    className="h-8 w-32"
                    aria-label={`Role of tooth ${t.tooth}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs capitalize text-text-3">
                  {roles[0]}
                </span>
              )}
              {field.withSurfaces && (
                <div
                  className="flex gap-0.5"
                  role="group"
                  aria-label={`Surfaces of tooth ${t.tooth}`}
                >
                  {TOOTH_SURFACES.map((s) => {
                    const on = t.surfaces?.includes(s) ?? false
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update(t.tooth, {
                            surfaces: on
                              ? (t.surfaces ?? []).filter((x) => x !== s)
                              : [...(t.surfaces ?? []), s],
                          })
                        }
                        className={cn(
                          'size-7 rounded border text-xs',
                          on
                            ? 'border-primary bg-primary-soft text-primary-text'
                            : 'border-border hover:bg-accent',
                        )}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}
              <TooltipButton
                tooltip={`Remove tooth ${t.tooth}`}
                variant="ghost"
                size="icon"
                className="ml-auto size-7"
                onClick={() => toggle(t.tooth)}
              >
                <X className="size-3.5" />
              </TooltipButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
