import { useState } from 'react'
import { History, Pencil, Plus, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatDate } from '@/lib/formatters'
import { useCompensationPlans } from '../../hooks/use-commissions'
import { bpsToPercent, formatMinor } from '../../lib/commission-math'
import type { CompensationPlan } from '../../types/commission.types'
import {
  CommissionRulesSheet,
  CompensationSheet,
  PLAN_TYPE_LABEL,
} from './CompensationSheet'

const CATEGORY_LABEL = {
  CONSULTATION: 'All consultations',
  PROCEDURE: 'All procedures',
  OTHER: 'All other services',
} as const

const earns = (p: CompensationPlan) => p.type !== 'SALARY'

function ruleLabel(r: CompensationPlan['rules'][number]): string {
  const target =
    r.serviceName ??
    (r.serviceCategory ? CATEGORY_LABEL[r.serviceCategory] : 'Service')
  const amount =
    r.rateBps !== null
      ? `${bpsToPercent(r.rateBps)}%`
      : `${formatMinor(r.fixedAmountMinor ?? 0)} per charge`
  return `${target}: ${amount}`
}

function PlanSummary({ plan }: { plan: CompensationPlan }) {
  const items = [
    { label: 'Type', value: PLAN_TYPE_LABEL[plan.type] },
    ...(plan.baseSalaryMinor !== null
      ? [{ label: 'Monthly salary', value: formatMinor(plan.baseSalaryMinor) }]
      : []),
    ...(earns(plan)
      ? [
          {
            label: 'Default commission',
            value: `${bpsToPercent(plan.defaultRateBps ?? 0)}%`,
          },
          {
            label: 'Commission on',
            value:
              plan.commissionBasis === 'NET'
                ? 'Amount after discount'
                : 'Amount before discount',
          },
        ]
      : []),
    { label: 'Since', value: formatDate(plan.effectiveFrom) },
  ]
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-sm text-muted-foreground">{i.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
      {earns(plan) && (
        <div>
          <p className="text-sm font-medium">Service-wise overrides</p>
          {plan.rules.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {plan.rules.map((r) => (
                <Badge key={r.id} variant="secondary" className="font-normal">
                  {ruleLabel(r)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              None — every service earns the default rate.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Employee detail → Compensation: current plan, change it, version history. */
export function CompensationTab({ assignmentId }: { assignmentId: string }) {
  const q = useCompensationPlans(assignmentId)
  const [sheet, setSheet] = useState<'plan' | 'rules' | null>(null)

  if (q.isLoading) return <LoadingSkeleton variant="detail" />
  if (q.isError || !q.data)
    return (
      <ErrorState
        description="Could not load compensation."
        onRetry={() => void q.refetch()}
      />
    )

  const { current, versions, canConsult, today } = q.data

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Wallet className="size-5" />
            Current compensation
          </CardTitle>
          <div className="flex gap-2">
            {current && earns(current) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSheet('rules')}
              >
                <Pencil className="size-4" />
                Edit overrides
              </Button>
            )}
            <Button size="sm" onClick={() => setSheet('plan')}>
              <Plus className="size-4" />
              {current ? 'Change plan' : 'Set up compensation'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {current ? (
            <PlanSummary plan={current} />
          ) : (
            <EmptyState
              icon={Wallet}
              title="No compensation in force"
              description="Set how this person is paid — salary, commission or both."
              action={
                <Button size="sm" onClick={() => setSheet('plan')}>
                  Set up compensation
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <History className="size-5" />
            Version history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Overrides</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow
                    key={v.id}
                    className="transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(v.effectiveFrom)} –{' '}
                      {v.effectiveTo ? formatDate(v.effectiveTo) : 'now'}
                      {v.isCurrent && (
                        <Badge className="ml-2" variant="secondary">
                          Current
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{PLAN_TYPE_LABEL[v.type]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.baseSalaryMinor !== null
                        ? formatMinor(v.baseSalaryMinor)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {earns(v)
                        ? `${bpsToPercent(v.defaultRateBps ?? 0)}% (${v.commissionBasis === 'NET' ? 'net' : 'gross'})`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {earns(v) ? v.rules.length || 'None' : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CompensationSheet
        assignmentId={assignmentId}
        current={current ?? versions.at(0) ?? null}
        canConsult={canConsult}
        today={today}
        open={sheet === 'plan'}
        onOpenChange={(o) => setSheet(o ? 'plan' : null)}
      />
      {current && earns(current) && (
        <CommissionRulesSheet
          plan={current}
          open={sheet === 'rules'}
          onOpenChange={(o) => setSheet(o ? 'rules' : null)}
        />
      )}
    </div>
  )
}
