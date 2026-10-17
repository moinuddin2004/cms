import { useState } from 'react'
import { MoreHorizontal, Pencil, Percent, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { FeatureGuard } from '@/context/FeatureFlagsContext'
import { formatCurrency } from '@/lib/formatters'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import { chargesApi } from '../../services/billing-v2.api'
import type { Charge } from '../../types/billing.types'
import { ReasonDialog } from '../shared/ReasonDialog'
import { DiscountSheet } from './DiscountSheet'
import { EditChargeSheet } from './EditChargeSheet'

/**
 * Discount / edit / void for one UNBILLED charge. Billed charges change
 * only through an invoice edit, so they get no actions here (D9, D10).
 */
export function ChargeRowActions({ charge }: { charge: Charge }) {
  const [open, setOpen] = useState<'discount' | 'edit' | 'void' | null>(null)
  const voidCharge = useBillingMutation(
    (reason: string) => chargesApi.void(charge.id, reason),
    {
      success: 'Charge voided',
    },
  )
  const removeDiscount = useBillingMutation(
    () => chargesApi.removeDiscount(charge.id),
    {
      success: 'Discount removed',
    },
  )

  if (charge.status !== 'ACTIVE' || charge.invoiceId) return null
  const close = (o: boolean) => !o && setOpen(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TooltipButton
            tooltip="Charge actions"
            variant="ghost"
            size="icon"
            className="size-8"
          >
            <MoreHorizontal className="size-4" />
          </TooltipButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <FeatureGuard feature="billing.discounts">
            <DropdownMenuItem onClick={() => setOpen('discount')}>
              <Percent className="size-4" /> Discount
            </DropdownMenuItem>
            {charge.discount && (
              <DropdownMenuItem
                onClick={() => removeDiscount.mutate(undefined)}
              >
                <Percent className="size-4" /> Remove discount
              </DropdownMenuItem>
            )}
          </FeatureGuard>
          <DropdownMenuItem onClick={() => setOpen('edit')}>
            <Pencil className="size-4" /> Edit quantity / price
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-danger"
            onClick={() => setOpen('void')}
          >
            <Trash2 className="size-4" /> Void
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DiscountSheet
        chargeIds={[charge.id]}
        open={open === 'discount'}
        onOpenChange={close}
      />
      <EditChargeSheet
        charge={charge}
        open={open === 'edit'}
        onOpenChange={close}
      />
      <ReasonDialog
        open={open === 'void'}
        onOpenChange={close}
        title="Void this charge?"
        description={`${charge.description} (${formatCurrency(charge.netAmount)}) will no longer be billed.`}
        confirmLabel="Void charge"
        onConfirm={(reason) => voidCharge.mutateAsync(reason)}
      />
    </>
  )
}
