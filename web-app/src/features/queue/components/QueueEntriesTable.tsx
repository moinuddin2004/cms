import { useMemo } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { DataTable } from '@/components/shared'
import type { QueuePermissions } from '../hooks/useQueuePermissions'
import { ENTRY_STATUS_LABELS } from '../types'
import type { QueueEntry, QueueLane, QueuePolicy } from '../types'
import { formatClock } from '../utils/queueError'
import { matchesQueueSearch } from '../utils/queueSearch'
import { EntryBadges } from './EntryBadges'
import { useAccess } from '@/features/access/hooks/useAccess'
import { QueueBillingCell, useOutstanding } from '@/features/billing'
import { QueueEntryActions } from './QueueEntryActions'
import type { EntryActionHandlers } from './QueueEntryActions'

/** Display order of statuses in the flat list (active first). */
const STATUS_ORDER: Record<string, number> = {
  called: 0,
  in_consultation: 1,
  waiting: 2,
  on_hold: 3,
  skipped: 4,
  completed: 5,
  transferred: 6,
  cancelled: 7,
  aborted: 8,
}

interface Row {
  entry: QueueEntry
  doctorId: string
  doctorName: string
  /** 1-based place in the engine's call order, for waiting patients. */
  position: number | null
  waiting: QueueEntry[]
}

/**
 * List view of the reception board: every patient in every doctor's queue
 * today in one sortable, paginated table, with the same actions as the lanes.
 */
export function QueueEntriesTable({
  lanes,
  q,
  now,
  policy,
  role,
  handlers,
}: {
  lanes: QueueLane[]
  q: string
  now: Date
  policy: QueuePolicy
  role: QueuePermissions
  handlers: EntryActionHandlers
}) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const lane of lanes) {
      const snap = lane.snapshot
      if (!snap) continue
      const byId = new Map(snap.entries.map((e) => [e.id, e]))
      const waiting = snap.waitingOrder
        .map((id) => byId.get(id))
        .filter((e): e is QueueEntry => !!e)
      for (const entry of snap.entries) {
        if (!matchesQueueSearch(entry, q)) continue
        const idx = snap.waitingOrder.indexOf(entry.id)
        out.push({
          entry,
          doctorId: lane.doctor.id,
          doctorName: lane.doctor.fullName,
          position: idx >= 0 ? idx + 1 : null,
          waiting,
        })
      }
    }
    return out.sort(
      (a, b) =>
        (STATUS_ORDER[a.entry.status] ?? 9) -
          (STATUS_ORDER[b.entry.status] ?? 9) ||
        (a.position ?? 999) - (b.position ?? 999) ||
        a.entry.checkedInAt.localeCompare(b.entry.checkedInAt),
    )
  }, [lanes, q])

  // Billing (admin + reception only, D22): dues badge + "Bill" when done.
  // `billing.desk.use` implies the billing.invoices feature.
  const showBilling = useAccess().can('billing.desk.use')
  const patientIds = useMemo(
    () => [
      ...new Set(
        rows.map((r) => r.entry.patient?.id).filter((id): id is string => !!id),
      ),
    ],
    [rows],
  )
  const outstanding = useOutstanding(showBilling ? patientIds : [])
  const duesByPatient = useMemo(
    () => new Map((outstanding.data ?? []).map((o) => [o.patientId, o])),
    [outstanding.data],
  )

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: 'token',
        header: 'Token',
        accessorFn: (r) => r.entry.tokenNumber,
        cell: ({ row }) => (
          <span className="font-mono text-sm font-bold tabular-nums">
            {row.original.entry.token}
          </span>
        ),
      },
      {
        id: 'patient',
        header: 'Patient',
        accessorFn: (r) => r.entry.patient?.fullName ?? '',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.entry.patient?.fullName ?? '—'}
            </p>
            <EntryBadges
              entry={row.original.entry}
              now={now}
              className="mt-0.5"
            />
          </div>
        ),
      },
      {
        id: 'doctor',
        header: 'Doctor',
        accessorFn: (r) => r.doctorName,
        cell: ({ row }) => (
          <span className="text-sm">Dr. {row.original.doctorName}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => STATUS_ORDER[r.entry.status] ?? 9,
        cell: ({ row }) => (
          <span className="text-sm">
            {ENTRY_STATUS_LABELS[row.original.entry.status]}
            {row.original.position ? (
              <span className="ml-1 text-xs text-muted-foreground">
                #{row.original.position}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'arrived',
        header: 'Arrived',
        accessorFn: (r) => r.entry.checkedInAt,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatClock(row.original.entry.checkedInAt)}
          </span>
        ),
      },
      ...(showBilling
        ? [
            {
              id: 'billing',
              header: 'Billing',
              enableSorting: false,
              cell: ({ row }: { row: { original: Row } }) => {
                const p = row.original.entry.patient
                if (!p) return null
                return (
                  <QueueBillingCell
                    patient={{
                      id: p.id,
                      name: p.fullName,
                      phone: p.phone,
                      mrn: p.patientNumber,
                    }}
                    outstanding={duesByPatient.get(p.id)}
                    canBillNow={row.original.entry.status === 'completed'}
                  />
                )
              },
            } satisfies ColumnDef<Row, unknown>,
          ]
        : []),
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <QueueEntryActions
            entry={row.original.entry}
            doctorId={row.original.doctorId}
            role={role}
            rejoinPolicy={policy.skippedRejoinPolicy}
            waiting={row.original.waiting}
            handlers={handlers}
          />
        ),
      },
    ],
    [
      now,
      role,
      policy.skippedRejoinPolicy,
      handlers,
      showBilling,
      duesByPatient,
    ],
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      pagination
      defaultPageSize={25}
      emptyMessage="Nobody has checked in yet today."
      getRowClassName={(r) =>
        ['completed', 'cancelled', 'transferred', 'aborted'].includes(
          r.entry.status,
        )
          ? 'opacity-60'
          : undefined
      }
    />
  )
}
