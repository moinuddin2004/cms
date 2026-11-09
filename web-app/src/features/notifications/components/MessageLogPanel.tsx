import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { formatInClinic } from '@/lib/datetime'
import { MessageSquareText } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
  Pagination,
  StatusBadge,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { useDebounce } from '@/hooks/useDebounce'
import { useNotificationLog } from '../hooks/useNotificationSettings'
import {
  AUDIENCE_LABEL,
  CHANNEL_LABEL,
  REASON_LABEL,
  STATUS_LABEL,
} from '../types'
import type {
  NotificationChannel,
  OutboxLogEntry,
  OutboxStatus,
} from '../types'

const STATUS_TONE: Record<
  OutboxStatus,
  'success' | 'warning' | 'danger' | 'muted' | 'info'
> = {
  queued: 'info',
  held_quiet_hours: 'warning',
  sent: 'success',
  delivered: 'success',
  failed: 'danger',
  skipped_disabled: 'muted',
  skipped_opt_out: 'muted',
  skipped_unverified: 'warning',
}

function LogStatus({ entry }: { entry: OutboxLogEntry }) {
  return (
    <StatusBadge
      status={entry.status}
      label={STATUS_LABEL[entry.status]}
      tone={STATUS_TONE[entry.status]}
    />
  )
}

const when = (iso: string) => formatInClinic(iso, 'd MMM, HH:mm')

/** §16 message log: what went out, when, and why the rest didn't. */
export function MessageLogPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const query = useDebounce(search.trim(), 300)
  const [status, setStatus] = useState<OutboxStatus | 'all'>('all')
  const [channel, setChannel] = useState<NotificationChannel | 'all'>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  const { data, isLoading, isError, isFetching, refetch } = useNotificationLog({
    page,
    limit,
    ...(query ? { search: query } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(channel !== 'all' ? { channel } : {}),
  })

  const activeFilters =
    (query ? 1 : 0) + (status !== 'all' ? 1 : 0) + (channel !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setChannel('all')
    setPage(1)
  }

  const columns = useMemo<ColumnDef<OutboxLogEntry, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'When',
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm tabular-nums text-text-2">
            {when(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'recipient',
        header: 'Recipient',
        accessorFn: (e) => e.recipientName ?? '',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.recipientName ?? '—'}
            </p>
            <p className="truncate text-xs text-text-3">
              {AUDIENCE_LABEL[row.original.audience]}
              {row.original.to ? ` · ${row.original.to}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'message',
        header: 'Message',
        enableSorting: false,
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-md text-sm text-text-2">
            {row.original.body}
          </p>
        ),
      },
      {
        id: 'channel',
        header: 'Channel',
        accessorKey: 'channel',
        cell: ({ row }) => (
          <span className="text-sm">{CHANNEL_LABEL[row.original.channel]}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <div className="space-y-1">
            <LogStatus entry={row.original} />
            <p className="text-xs text-text-3">
              {row.original.lastError ??
                REASON_LABEL[row.original.reason] ??
                row.original.reason}
            </p>
          </div>
        ),
      },
    ],
    [],
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const pagination = {
    page,
    pageSize: limit,
    total,
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setLimit(size)
      setPage(1)
    },
    pageSizeOptions: [10, 20, 50, 100],
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder="Search by name, number or text…"
        activeFilters={activeFilters}
        onClear={clearFilters}
        resultLabel={
          isFetching && !isLoading
            ? 'Updating…'
            : `${total} message${total === 1 ? '' : 's'}`
        }
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as OutboxStatus | 'all')
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as OutboxStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={channel}
              onValueChange={(v) => {
                setChannel(v as NotificationChannel | 'all')
                setPage(1)
              }}
            >
              <SelectTrigger
                className="h-9 w-full sm:w-40"
                aria-label="Filter by channel"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {CHANNEL_LABEL[c]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </>
        }
      />

      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : total === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No messages yet"
          description="Every notification — sent, held or skipped — is listed here with the reason."
        />
      ) : total === 0 ? (
        <NoResultsState
          message="No messages match your filters."
          onClear={clearFilters}
        />
      ) : viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={rows}
          pagination={false}
          serverPagination={pagination}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((e) => (
              <article
                key={e.id}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {e.recipientName ?? '—'}
                    </p>
                    <p className="text-xs text-text-3">
                      {CHANNEL_LABEL[e.channel]} · {when(e.createdAt)}
                    </p>
                  </div>
                  <LogStatus entry={e} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-text-2">
                  {e.body}
                </p>
                <p className="mt-2 text-xs text-text-3">
                  {e.lastError ?? REASON_LABEL[e.reason] ?? e.reason}
                </p>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / limit))}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={pagination.onPageSizeChange}
            pageSizeOptions={pagination.pageSizeOptions}
          />
        </div>
      )}
    </div>
  )
}
