import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OutstandingRow, PatientRef } from '../../types/billing.types'
import { CollectPaymentSheet } from '../collect-payment/CollectPaymentSheet'
import { OutstandingBadge } from '../shared/billing-badges'

/**
 * Billing bits of one reception queue row (plan §8.1): the dues / advance
 * badge from check-in onward and a "Bill" button once the visit is done.
 * Only rendered for admin and reception.
 */
export function QueueBillingCell({
  patient,
  outstanding,
  canBillNow,
}: {
  patient: PatientRef
  outstanding: OutstandingRow | undefined
  canBillNow: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <OutstandingBadge row={outstanding} />
      {canBillNow && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setOpen(true)}
        >
          <Receipt className="size-3.5" /> Bill
        </Button>
      )}
      {open && (
        <CollectPaymentSheet
          patient={patient}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  )
}
