import { Link } from '@tanstack/react-router'
import { CheckCircle2, Flag, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
} from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { formatPaisa } from '@/features/lab-catalog'
import { MatchBadge, StatementStatusBadge } from '../components/payables-badges'
import { useLabStatement, usePayablesMutation } from '../hooks/useLabPayables'
import { labPayablesApi } from '../services/lab-payables.api'
import type { LabStatementDetail, MatchStatus } from '../types'

const ORDER: MatchStatus[] = [
  'amount_mismatch',
  'missing_in_system',
  'missing_in_statement',
  'matched',
]

/**
 * The reconcile screen (lab ERD §6c "Statement matching"): every statement
 * line next to what the clinic's bills say, plus bills the lab left out.
 */
export function LabStatementDetailPage({
  statementId,
}: {
  statementId: string
}) {
  const { data: s, isLoading, isError, refetch } = useLabStatement(statementId)
  const setStatus = usePayablesMutation(
    (v: { s: LabStatementDetail; status: 'reconciled' | 'disputed' }) =>
      labPayablesApi.statementStatus(v.s.id, {
        version: v.s.version,
        status: v.status,
      }),
    'Statement updated',
  )
  const back = {
    backTo: '/lab-payables/statements',
    backLabel: 'Back to statements',
  }

  if (isLoading)
    return (
      <DashboardLayout title="Lab statement" {...back}>
        <LoadingSkeleton variant="detail" />
      </DashboardLayout>
    )
  if (isError || !s)
    return (
      <DashboardLayout title="Lab statement" {...back}>
        <ErrorState onRetry={() => void refetch()} />
      </DashboardLayout>
    )

  const lines = [...s.lines].sort(
    (a, b) => ORDER.indexOf(a.matchStatus) - ORDER.indexOf(b.matchStatus),
  )
  const c = s.counts ?? {}
  const pending = setStatus.isPending ? setStatus.variables.status : null
  const actions = (
    <div className="flex gap-2">
      {s.status !== 'disputed' && (
        <Button
          variant="outline"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ s, status: 'disputed' })}
        >
          {pending === 'disputed' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Flag className="size-4" />
          )}
          Dispute
        </Button>
      )}
      {s.status !== 'reconciled' && (
        <Button
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ s, status: 'reconciled' })}
        >
          {pending === 'reconciled' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Mark reconciled
        </Button>
      )}
    </div>
  )

  return (
    <DashboardLayout
      title={`${s.labName ?? 'Lab'} statement`}
      subtitle={`${s.periodStart} – ${s.periodEnd}${s.statementRef ? ` · ${s.statementRef}` : ''}`}
      actions={actions}
      {...back}
    >
      <div className="space-y-6">
        <StatementStatusBadge status={s.status} />
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Matched" value={String(c.matched ?? 0)} />
          <StatCard
            label="Amount differs"
            value={String(c.amount_mismatch ?? 0)}
          />
          <StatCard
            label="Not in our bills"
            value={String(c.missing_in_system ?? 0)}
          />
          <StatCard
            label="Not on statement"
            value={String(c.missing_in_statement ?? 0)}
          />
        </div>
        {lines.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No lines"
            description="This statement has no lines."
          />
        ) : (
          <section className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-text-3">
                <tr>
                  <th className="px-4 py-2">Lab reference</th>
                  <th className="px-4 py-2">Our bill</th>
                  <th className="px-4 py-2 text-right">Lab says</th>
                  <th className="px-4 py-2 text-right">Our bills say</th>
                  <th className="px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-2">
                      {l.labReference ?? '—'}
                      {l.description && (
                        <p className="text-xs text-text-3">{l.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {l.matchedBillId ? (
                        <Link
                          to="/lab-payables/bills/$billId"
                          params={{ billId: l.matchedBillId }}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {l.billNo}
                          {l.orderNo ? ` · ${l.orderNo}` : ''}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.matchStatus === 'missing_in_statement'
                        ? '—'
                        : formatPaisa(l.amountPaisa)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.systemAmountPaisa === null
                        ? '—'
                        : formatPaisa(l.systemAmountPaisa)}
                    </td>
                    <td className="px-4 py-2">
                      <MatchBadge status={l.matchStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}
