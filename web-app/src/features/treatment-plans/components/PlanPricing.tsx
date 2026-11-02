import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { NumberInput } from '@/components/forms/NumberInput'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ServiceOption } from '../types'
import type { PlanTotals } from '../utils/planMath'

/** Pick a catalog service; shows its price when the user may see prices. */
export function ServiceSelect({
  services,
  value,
  onChange,
  invalid,
  label = 'Service',
}: {
  services: ServiceOption[]
  value: string
  onChange: (serviceId: string) => void
  invalid?: boolean
  label?: string
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        className="h-9 w-full min-w-0"
        aria-label={label}
        aria-invalid={invalid}
      >
        <SelectValue placeholder="Choose a service" />
      </SelectTrigger>
      <SelectContent>
        {services.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.price == null
              ? s.name
              : `${s.name} — ${formatCurrency(s.price)}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const KIND_OPTIONS = [
  { value: 'none', label: 'No discount' },
  { value: 'PERCENTAGE', label: 'Percent (%)' },
  { value: 'FIXED', label: 'Amount (Rs.)' },
]

/** Discount kind + value for a whole plan or template. */
export function DiscountInputs({
  kind,
  value,
  onKindChange,
  onValueChange,
  onBlur,
  error,
}: {
  kind: string
  value: string
  onKindChange: (kind: string) => void
  onValueChange: (value: string) => void
  onBlur?: () => void
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
        <Select
          value={kind || 'none'}
          onValueChange={(v) => onKindChange(v === 'none' ? '' : v)}
        >
          <SelectTrigger className="h-9 w-full" aria-label="Discount type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <NumberInput
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={onBlur}
          disabled={!kind}
          placeholder={kind === 'PERCENTAGE' ? '%' : 'Rs.'}
          aria-label="Discount value"
          aria-invalid={!!error}
          className="h-9"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** Total − discount = final, as on the bill. */
export function PlanTotalsView({
  totals,
  className,
}: {
  totals: PlanTotals
  className?: string
}) {
  return (
    <dl
      className={cn(
        'space-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm',
        className,
      )}
    >
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Total</dt>
        <dd className="tabular-nums">{formatCurrency(totals.total)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Discount</dt>
          <dd className="tabular-nums text-emerald">
            − {formatCurrency(totals.discount)}
          </dd>
        </div>
      )}
      <div className="flex justify-between border-t border-border pt-1 font-semibold">
        <dt>Patient pays</dt>
        <dd className="tabular-nums">{formatCurrency(totals.final)}</dd>
      </div>
    </dl>
  )
}
