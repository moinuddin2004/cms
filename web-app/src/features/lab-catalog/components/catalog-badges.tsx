import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPaisa } from '../lib/money'
import { PRICE_SOURCE_LABEL, UNIT_TYPE_LABEL } from '../types'
import type { EffectivePrice, UnitType } from '../types'

export function UnitTypeBadge({ unitType }: { unitType: UnitType }) {
  return (
    <Badge variant="outline" className="font-normal">
      {UNIT_TYPE_LABEL[unitType]}
    </Badge>
  )
}

export function ArchivedBadge() {
  return (
    <Badge variant="secondary" className="font-normal">
      Archived
    </Badge>
  )
}

/** A resolved price with where it came from (your rate vs list price). */
export function PriceTag({
  price,
  className,
}: {
  price: EffectivePrice | null
  className?: string
}) {
  if (!price) {
    return (
      <span className={cn('text-sm text-text-3', className)}>No price</span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="text-sm font-medium tabular-nums">
        {formatPaisa(price.unitPricePaisa, price.currency)}
      </span>
      <Badge
        variant={price.source === 'negotiated' ? 'default' : 'outline'}
        className="font-normal"
      >
        {PRICE_SOURCE_LABEL[price.source]}
      </Badge>
    </span>
  )
}
