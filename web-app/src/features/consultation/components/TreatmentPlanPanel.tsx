import { useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useAccess } from '@/features/access/hooks/useAccess'
import { usePlanBillingSummary } from '@/features/billing'
import {
  PlanItemStatus,
  TreatmentPlanSheet,
  TreatmentPlanStatus,
  isOpenPlan,
  stepLabel,
  stepOpen,
  useAcceptPlan,
  useCancelPlan,
  useRecordPlanSession,
  useTreatmentPlans,
} from '@/features/treatment-plans'
import type {
  TreatmentPlan,
  TreatmentPlanItem,
} from '@/features/treatment-plans'
import { formatCurrency } from '@/lib/formatters'
import { Chip } from './Chip'
import { Panel, PanelBadge } from './Panel'

/**
 * Long treatments on the consultation screen. A plan's open steps are chips:
 * tap the one done today and it is recorded on this visit (the plan's first
 * session issues its one bill). "+ Plan" opens the plan sheet.
 */
export function TreatmentPlanPanel({
  patientId,
  encounterId,
  dentistId,
}: {
  patientId: string
  encounterId: string
  dentistId: string | null
}) {
  const { can } = useAccess()
  const canManage = can('plans.manage')
  const {
    data: plans = [],
    isLoading,
    isError,
    refetch,
  } = useTreatmentPlans(patientId)
  const open = plans.filter(isOpenPlan)
  const [sheet, setSheet] = useState<{ plan: TreatmentPlan | null } | null>(
    null,
  )

  return (
    <Panel
      icon={<ClipboardList />}
      title="Treatment plan"
      badge={
        open.length > 0 ? <PanelBadge>{open.length}</PanelBadge> : undefined
      }
      action={
        canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setSheet({ plan: null })}
          >
            <Plus className="size-3.5" /> Plan
          </Button>
        )
      }
      bodyClassName="space-y-3"
    >
      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">Loading plans…</p>
      ) : isError ? (
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-destructive">Could not load plans.</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : open.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No plan yet. For treatment over several visits (RCT, implant,
          braces…), make a plan — the patient gets one bill for all of it.
        </p>
      ) : (
        open.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            patientId={patientId}
            encounterId={encounterId}
            canManage={canManage}
            onEdit={() => setSheet({ plan })}
          />
        ))
      )}

      {sheet && (
        <TreatmentPlanSheet
          key={sheet.plan?.id ?? 'new'}
          open
          onOpenChange={(o) => !o && setSheet(null)}
          patientId={patientId}
          dentistId={dentistId}
          encounterId={encounterId}
          plan={sheet.plan}
        />
      )}
    </Panel>
  )
}

function PlanCard({
  plan,
  patientId,
  encounterId,
  canManage,
  onEdit,
}: {
  plan: TreatmentPlan
  patientId: string
  encounterId: string
  canManage: boolean
  onEdit: () => void
}) {
  const { can } = useAccess()
  const accept = useAcceptPlan(patientId)
  const cancel = useCancelPlan(patientId)
  const session = useRecordPlanSession(patientId)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const done = plan.items.filter(
    (i) => i.status === PlanItemStatus.COMPLETED,
  ).length
  const steps = plan.items.filter((i) => i.status !== PlanItemStatus.SKIPPED)
  const draft = plan.status === TreatmentPlanStatus.DRAFT

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{plan.planName}</p>
          <p className="text-[11px] text-muted-foreground">
            {plan.planNumber} · {done}/{steps.length} done
            {draft ? ' · not accepted yet' : ''}
          </p>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TooltipButton
                tooltip="Plan actions"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
              >
                {accept.isPending || cancel.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </TooltipButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {draft && (
                <DropdownMenuItem onSelect={() => accept.mutate(plan.id)}>
                  Patient accepted
                </DropdownMenuItem>
              )}
              {!plan.startedAt && (
                <DropdownMenuItem onSelect={onEdit}>Edit plan</DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => setConfirmCancel(true)}
              >
                Cancel plan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {plan.finalEstimatedCost != null && (
        <PlanMoney
          plan={plan}
          showPaid={!!plan.invoiceId && can('billing.invoice.view')}
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {steps.map((step) =>
          stepOpen(step) ? (
            <Chip
              key={step.id}
              disabled={!canManage || session.isPending}
              onClick={() =>
                session.mutate({
                  planId: plan.id,
                  itemId: step.id,
                  encounterId,
                })
              }
            >
              {session.isPending && session.variables.itemId === step.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {stepText(step)}
            </Chip>
          ) : (
            <span
              key={step.id}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-soft px-3 text-[13px] text-emerald"
            >
              <CheckCircle2 className="size-3.5" />
              {stepLabel(step)}
            </span>
          ),
        )}
      </div>
      {canManage && steps.some(stepOpen) && (
        <p className="text-[11px] text-muted-foreground">
          Tap a step done in this visit.
          {!plan.startedAt && ' Its bill is made when you complete this visit.'}
        </p>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel ${plan.planName}?`}
        description={
          plan.invoiceId
            ? 'Steps not done are dropped. Its bill is already issued — reception will adjust it.'
            : 'Steps not done are dropped. This cannot be undone.'
        }
        confirmLabel="Cancel plan"
        destructive
        isLoading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(plan.id, { onSuccess: () => setConfirmCancel(false) })
        }
      />
    </div>
  )
}

/** "RCT #36 (1/3)" for steps that take several sessions. */
function stepText(step: TreatmentPlanItem) {
  return step.estimatedSessions > 1
    ? `${stepLabel(step)} (${step.completedSessions + 1}/${step.estimatedSessions})`
    : stepLabel(step)
}

function PlanMoney({
  plan,
  showPaid,
}: {
  plan: TreatmentPlan
  showPaid: boolean
}) {
  return (
    <p className="text-[12px] tabular-nums text-muted-foreground">
      Plan {formatCurrency(Number(plan.finalEstimatedCost ?? 0))}
      {Number(plan.discountAmount ?? 0) > 0 &&
        ` (discount ${formatCurrency(Number(plan.discountAmount))})`}
      {showPaid && <PaidBalance planId={plan.id} />}
    </p>
  )
}

function PaidBalance({ planId }: { planId: string }) {
  const { data } = usePlanBillingSummary(planId)
  if (!data) return null
  return (
    <>
      {' · '}Paid {formatCurrency(data.paid)} · Due{' '}
      <span className="font-semibold text-foreground">
        {formatCurrency(data.balance)}
      </span>
    </>
  )
}
