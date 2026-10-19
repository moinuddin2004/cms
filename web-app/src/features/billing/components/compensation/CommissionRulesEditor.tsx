import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { OptionSelect } from '../shared/OptionSelect'
import { useCatalogServices } from '../../hooks/use-billing-queries'
import { ruleRowErrors } from '../../schemas/commission.schema'
import type { RuleRow } from '../../schemas/commission.schema'

const CATEGORY_OPTIONS = [
  { value: 'cat:CONSULTATION', label: 'All consultations' },
  { value: 'cat:PROCEDURE', label: 'All procedures' },
  { value: 'cat:OTHER', label: 'All other services' },
]

/**
 * Service-wise overrides: one row per service or category, each a % or a
 * fixed amount. Controlled — the parent form owns the `rules` array.
 */
export function CommissionRulesEditor({
  value,
  onChange,
  showErrors,
  disabled,
}: {
  value: RuleRow[]
  onChange: (rows: RuleRow[]) => void
  showErrors: boolean
  disabled?: boolean
}) {
  const services = useCatalogServices({ activeOnly: true })
  const options = [
    ...CATEGORY_OPTIONS,
    ...(services.data ?? []).map((s) => ({
      value: `svc:${s.id}`,
      label: s.name,
    })),
  ]
  const errors = ruleRowErrors(value)
  const update = (i: number, patch: Partial<RuleRow>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No overrides — every service earns the default rate.
        </p>
      )}
      {value.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto_7rem_auto] items-start gap-2"
        >
          <div className="space-y-1">
            <OptionSelect
              options={options}
              value={row.target}
              onChange={(v) => update(i, { target: v })}
              placeholder={
                services.isLoading ? 'Loading…' : 'Service or category'
              }
              disabled={disabled}
            />
            {showErrors && errors[i]?.target && (
              <p className="text-xs text-danger">{errors[i].target}</p>
            )}
          </div>
          <div
            className="flex overflow-hidden rounded-md border border-border text-xs"
            role="radiogroup"
            aria-label="Override type"
          >
            {(['percent', 'fixed'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={row.mode === m}
                disabled={disabled}
                onClick={() => update(i, { mode: m })}
                className={cn(
                  'px-2.5 py-2 transition-colors',
                  row.mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                {m === 'percent' ? '%' : 'Rs'}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <Input
              inputMode="decimal"
              className="tabular-nums"
              aria-label={row.mode === 'percent' ? 'Percent' : 'Fixed amount'}
              placeholder={row.mode === 'percent' ? 'e.g. 40' : 'e.g. 500'}
              value={row.value}
              disabled={disabled}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            {showErrors && errors[i]?.value && (
              <p className="text-xs text-danger">{errors[i].value}</p>
            )}
          </div>
          <TooltipButton
            tooltip="Remove override"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-4" />
          </TooltipButton>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange([...value, { target: '', mode: 'percent', value: '' }])
        }
      >
        <Plus className="size-4" />
        Add override
      </Button>
    </div>
  )
}
