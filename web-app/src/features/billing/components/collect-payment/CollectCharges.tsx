import { useState } from 'react'
import { Percent, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FeatureGuard } from '@/context/FeatureFlagsContext'
import { formatDate } from '@/lib/formatters'
import type { Charge } from '../../types/billing.types'
import { AddChargeSheet } from '../charges/AddChargeSheet'
import { ChargeRowActions } from '../charges/ChargeRowActions'
import { DiscountSheet } from '../charges/DiscountSheet'
import { ChargeBadges, Money } from '../shared/billing-badges'
import { useCollect } from './collect-context'

/** "Not invoiced yet" first, then one group per invoice number (plan §8.2.2). */
function groupCharges(
  charges: Charge[],
): Array<{ key: string; title: string; rows: Charge[] }> {
  const groups = new Map<
    string,
    { key: string; title: string; rows: Charge[] }
  >()
  for (const c of charges) {
    const key = c.invoiceId ?? 'unbilled'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: c.invoiceNumber
          ? `Invoice ${c.invoiceNumber}`
          : 'Not invoiced yet',
        rows: [],
      })
    }
    groups.get(key)?.rows.push(c)
  }
  return [...groups.values()].sort((a, b) =>
    a.key === 'unbilled' ? -1 : b.key === 'unbilled' ? 1 : 0,
  )
}

export function CollectCharges() {
  const { patientId, state, dispatch, charges, chargesLoading } = useCollect()
  const [addOpen, setAddOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const unbilledSelected = charges
    .filter((c) => !c.invoiceId && state.selected.includes(c.id))
    .map((c) => c.id)

  return (
    <section className="space-y-3" aria-label="Charges">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={
              charges.length > 0 && state.selected.length === charges.length
            }
            onCheckedChange={() =>
              dispatch({
                type: 'toggleAll',
                chargeIds: charges.map((c) => c.id),
              })
            }
            aria-label="Select all charges"
          />
          Charges
        </label>
        <div className="flex gap-2">
          <FeatureGuard feature="billing.discounts">
            <Button
              size="sm"
              variant="outline"
              disabled={!unbilledSelected.length}
              onClick={() => setDiscountOpen(true)}
            >
              <Percent className="size-3.5" /> Discount
            </Button>
          </FeatureGuard>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add charge
          </Button>
        </div>
      </div>

      {chargesLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : charges.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nothing to pay. Any amount received now is kept as advance.
        </p>
      ) : (
        groupCharges(charges).map((g) => (
          <div
            key={g.key}
            className="overflow-hidden rounded-lg border border-border"
          >
            <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {g.title}
            </div>
            {g.rows.map((c) => (
              <ChargeLine key={c.id} charge={c} />
            ))}
          </div>
        ))
      )}

      <AddChargeSheet
        patientId={patientId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <DiscountSheet
        chargeIds={unbilledSelected}
        open={discountOpen}
        onOpenChange={setDiscountOpen}
      />
    </section>
  )
}

function ChargeLine({ charge }: { charge: Charge }) {
  const { state, dispatch } = useCollect()
  const checked = state.selected.includes(charge.id)
  return (
    <div className="flex items-center gap-3 border-t border-border-soft px-3 py-2 text-sm first:border-t-0 hover:bg-muted/30">
      <Checkbox
        checked={checked}
        onCheckedChange={() =>
          dispatch({ type: 'toggle', chargeId: charge.id })
        }
        aria-label={`Select ${charge.description}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span dir="auto" className="truncate font-medium">
            {charge.description}
          </span>
          {charge.quantity > 1 && (
            <span className="text-xs text-muted-foreground">
              ×{charge.quantity}
            </span>
          )}
          <ChargeBadges charge={charge} />
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(charge.chargeDate)}
          {charge.doctorName && ` · ${charge.doctorName}`}
          {charge.discount && ` · ${charge.discount.name} −`}
          {charge.discount && <Money value={charge.discount.amount} />}
        </div>
      </div>
      <div className="text-right text-xs">
        <Money value={charge.balance} className="block text-sm font-semibold" />
        {charge.allocatedAmount > 0 && (
          <span className="text-muted-foreground">
            of <Money value={charge.netAmount} />
          </span>
        )}
      </div>
      {state.mode === 'MANUAL' && checked && (
        <Input
          aria-label={`Pay now for ${charge.description}`}
          inputMode="decimal"
          className="h-8 w-24 text-right tabular-nums"
          value={state.manual[charge.id] ?? ''}
          onChange={(e) =>
            dispatch({
              type: 'manual',
              chargeId: charge.id,
              amount: e.target.value,
            })
          }
        />
      )}
      <ChargeRowActions charge={charge} />
    </div>
  )
}
