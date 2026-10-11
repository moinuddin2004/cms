import { Card } from '@/components/ui/card'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Stethoscope,
  Banknote,
  Calendar,
  Check,
  Minus,
  Plus,
} from 'lucide-react'
import {
  useTreatmentPlans,
  useUpdateTreatmentPlan,
  useUpdateTreatmentPlanItem,
} from '../../hooks/usePatientSubEntities'
import {
  TreatmentPlanStatus,
  PlanItemStatus,
  type Patient,
  type PatientTreatmentPlan,
  type TreatmentPlanItem,
} from '../../types'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TreatmentPlanFormDialog } from './TreatmentPlanFormDialog'
import { PlanItemFormDialog } from './PlanItemFormDialog'

const PLAN_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  proposed: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
}

const ITEM_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  skipped: 'bg-muted text-muted-foreground line-through',
}

const num = (v: number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v

export function TreatmentPlansTab({ patient }: { patient: Patient }) {
  const { data: plans = [], isLoading } = useTreatmentPlans(patient.id)

  return (
    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="text-brand-600" size={20} />
            Treatment Plans
          </h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive multi-session plans and estimates.
          </p>
        </div>
        <TreatmentPlanFormDialog patientId={patient.id} />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="min-h-[200px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
          <Stethoscope size={32} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">No treatment plans found.</p>
          <p className="text-xs">
            Create a new treatment plan to sequence procedures and provide cost
            estimates.
          </p>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-3">
          {plans.map((plan) => (
            <PlanAccordionItem key={plan.id} plan={plan} />
          ))}
        </Accordion>
      )}
    </div>
  )
}

function PlanAccordionItem({ plan }: { plan: PatientTreatmentPlan }) {
  const { mutate: updatePlan, isPending } = useUpdateTreatmentPlan()

  const items = plan.items ?? []
  const total = items.length
  const done = items.filter((i) => i.status === PlanItemStatus.COMPLETED).length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <AccordionItem
      value={plan.id}
      className="border rounded-lg bg-card px-4 pt-1 shadow-sm data-[state=open]:ring-1 ring-brand-200"
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 items-center justify-between pr-4">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">{plan.planNumber}</span>
              <span className="hidden sm:inline-block text-muted-foreground ml-2 text-sm">
                {plan.planName}
              </span>
              <Badge
                variant="secondary"
                className={
                  PLAN_STATUS_STYLES[plan.status] ??
                  'bg-muted text-muted-foreground'
                }
              >
                {plan.status.replace('_', ' ').toUpperCase()}
              </Badge>
              {plan.patientAccepted && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 bg-brand-50 text-brand-700"
                >
                  ACCEPTED
                </Badge>
              )}
            </div>
            {total > 0 && (
              <div className="flex items-center gap-2 mt-0.5">
                <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-brand-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {done}/{total} done
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 mr-4">
            <div className="flex items-center gap-1 font-semibold text-brand-700">
              <Banknote size={14} /> Rs.{' '}
              {num(
                plan.finalEstimatedCost ?? plan.estimatedCost,
              ).toLocaleString()}
            </div>
            {plan.expectedEndDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar size={12} /> Target:{' '}
                {new Date(plan.expectedEndDate).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-2 pb-4">
        <div className="pl-2 pr-2">
          {plan.description && (
            <p className="text-sm text-muted-foreground mb-4 border-l-2 border-brand-200 pl-3">
              {plan.description}
            </p>
          )}

          {/* Plan-level actions */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
              <Select
                value={plan.status}
                onValueChange={(v) =>
                  updatePlan({
                    patientId: plan.patientId,
                    planId: plan.id,
                    status: v,
                  })
                }
              >
                <SelectTrigger
                  className="h-8 w-40 text-xs"
                  disabled={isPending}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TreatmentPlanStatus).map((s) => (
                    <SelectItem
                      key={s}
                      value={s}
                      className="capitalize text-xs"
                    >
                      {s.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!plan.patientAccepted ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  updatePlan({
                    patientId: plan.patientId,
                    planId: plan.id,
                    patientAccepted: true,
                    // Auto-activate a draft/proposed plan once the patient accepts.
                    status:
                      plan.status === TreatmentPlanStatus.DRAFT ||
                      plan.status === TreatmentPlanStatus.PROPOSED
                        ? TreatmentPlanStatus.ACTIVE
                        : plan.status,
                  })
                }
              >
                <Check size={14} className="mr-1.5" /> Mark accepted & proceed
              </Button>
            ) : (
              <span className="text-xs text-green-700 flex items-center gap-1">
                <Check size={14} /> Patient accepted
                {plan.patientAcceptedAt
                  ? ` on ${new Date(plan.patientAcceptedAt).toLocaleDateString()}`
                  : ''}
              </span>
            )}
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-2">Seq</th>
                  <th className="px-4 py-2">Procedure</th>
                  <th className="px-4 py-2">Tooth</th>
                  <th className="px-4 py-2">Sessions</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length > 0 ? (
                  items.map((item) => (
                    <PlanItemRow
                      key={item.id}
                      item={item}
                      patientId={plan.patientId}
                      planId={plan.id}
                    />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-4 text-center text-muted-foreground italic"
                    >
                      No procedures added to this plan yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <PlanItemFormDialog patientId={plan.patientId} planId={plan.id} />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function PlanItemRow({
  item,
  patientId,
  planId,
}: {
  item: TreatmentPlanItem
  patientId: string
  planId: string
}) {
  const { mutate: updateItem, isPending } = useUpdateTreatmentPlanItem()
  const completed = num(item.completedSessions)
  const estimated = num(item.estimatedSessions) || 1

  const setSessions = (next: number) =>
    updateItem({
      patientId,
      planId,
      itemId: item.id,
      completedSessions: Math.max(0, Math.min(next, estimated)),
      // Auto-advance status as sessions progress.
      status:
        next >= estimated
          ? PlanItemStatus.COMPLETED
          : next > 0
            ? PlanItemStatus.IN_PROGRESS
            : item.status,
    })

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 font-medium">{item.sequenceOrder}</td>
      <td className="px-4 py-2.5">
        <div className="font-medium">{item.procedureName}</div>
        {item.procedureCode && (
          <div className="text-[10px] text-muted-foreground uppercase">
            {item.procedureCode}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        {item.toothNumber ? (
          <Badge variant="outline">{item.toothNumber}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          <TooltipButton
            tooltip="Decrease completed sessions"
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={isPending || completed <= 0}
            onClick={() => setSessions(completed - 1)}
          >
            <Minus size={12} />
          </TooltipButton>
          <span className="text-xs tabular-nums w-10 text-center text-muted-foreground">
            {completed} / {estimated}
          </span>
          <TooltipButton
            tooltip="Increase completed sessions"
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={isPending || completed >= estimated}
            onClick={() => setSessions(completed + 1)}
          >
            <Plus size={12} />
          </TooltipButton>
        </div>
      </td>
      <td className="px-4 py-2.5 font-medium">
        Rs. {num(item.estimatedCost).toLocaleString()}
      </td>
      <td className="px-4 py-2.5">
        <Select
          value={item.status}
          onValueChange={(v) =>
            updateItem({ patientId, planId, itemId: item.id, status: v })
          }
        >
          <SelectTrigger
            className={`h-7 w-32 text-[11px] border-none ${
              ITEM_STATUS_STYLES[item.status] ?? ''
            }`}
            disabled={isPending}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(PlanItemStatus).map((s) => (
              <SelectItem key={s} value={s} className="capitalize text-xs">
                {s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
  )
}
