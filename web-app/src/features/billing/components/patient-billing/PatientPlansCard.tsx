import { useState } from 'react'
import type { ReactNode } from 'react'
import { ClipboardList, Percent } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAccess } from '@/features/access'
import {
  PlanDiscountSheet,
  TreatmentPlanStatus,
  useTreatmentPlans,
} from '@/features/treatment-plans'
import type { TreatmentPlan } from '@/features/treatment-plans'
import { usePlanBillingSummary } from '../../hooks/use-billing-queries'
import { Money } from '../shared/billing-badges'

const STATUS_LABEL: Partial<Record<TreatmentPlanStatus, string>> = {
  [TreatmentPlanStatus.DRAFT]: 'Not accepted',
  [TreatmentPlanStatus.ACTIVE]: 'In treatment',
  [TreatmentPlanStatus.COMPLETED]: 'Completed',
}

/**
 * The patient's treatment plans on the Billing tab: each plan's agreed
 * total, what is paid and what is still due on its one bill. Before
 * treatment starts, reception can set the plan discount here.
 */
export function PatientPlansCard({ patientId }: { patientId: string }) {
  const { can } = useAccess()
  const { data: plans = [] } = useTreatmentPlans(patientId)
  const [discountFor, setDiscountFor] = useState<TreatmentPlan | null>(null)
  const shown = plans.filter(
    (p) =>
      p.status !== TreatmentPlanStatus.CANCELLED &&
      p.finalEstimatedCost != null,
  )
  if (!shown.length) return null
  const canDiscount =
    can('billing.discount.apply') && can('patients.price.view')

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-sm font-semibold">
        <ClipboardList className="size-4 text-primary-text" /> Treatment plans
      </div>
      <ul className="divide-y divide-border">
        {shown.map((plan) => (
          <li
            key={plan.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{plan.planName}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{plan.planNumber}</span>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {STATUS_LABEL[plan.status] ?? plan.status}
                </Badge>
                {!plan.invoiceId && 'Billed when the visit is completed'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Figure label="Plan">
                <Money value={Number(plan.finalEstimatedCost ?? 0)} />
                {Number(plan.discountAmount ?? 0) > 0 && (
                  <span className="text-xs text-emerald">
                    {' '}
                    (−
                    <Money value={Number(plan.discountAmount)} />)
                  </span>
                )}
              </Figure>
              {plan.invoiceId && <PaidDue planId={plan.id} />}
              {canDiscount && !plan.startedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDiscountFor(plan)}
                >
                  <Percent className="size-3.5" /> Discount
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {discountFor && (
        <PlanDiscountSheet
          key={discountFor.id}
          open
          onOpenChange={(o) => !o && setDiscountFor(null)}
          patientId={patientId}
          plan={discountFor}
        />
      )}
    </Card>
  )
}

function PaidDue({ planId }: { planId: string }) {
  const { data } = usePlanBillingSummary(planId)
  if (!data) return null
  return (
    <>
      <Figure label="Paid">
        <Money value={data.paid} />
      </Figure>
      <Figure label="Due">
        <Money value={data.balance} className="font-semibold" />
      </Figure>
    </>
  )
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-right">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="tabular-nums">{children}</p>
    </div>
  )
}
