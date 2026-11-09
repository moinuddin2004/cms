import { useMemo, useState } from 'react'
import { formatInClinic } from '@/lib/datetime'
import type { ColumnDef } from '@/components/shared/table-features'
import {
  ClipboardCheck,
  Factory,
  Loader2,
  PackageX,
  Play,
  Printer,
  RotateCcw,
  Truck,
  UserCog,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  REMAKE_REASON_LABEL,
  ReasonDialog,
  SHIPMENT_STATUS_LABEL,
} from '@/features/lab-orders'
import { useDebounce } from '@/hooks/useDebounce'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { useActiveLab } from '../hooks/useLabPortal'
import { AssignSheet, DispatchSheet } from './components/ProductionSheets'
import { printShipmentSlip } from './print-shipment-slip'
import { labProductionApi } from './production.api'
import { nextLabStep, PRODUCTION_STATUS_FILTERS } from './types'
import type { LabProductionItem, RemakeRequest, Shipment } from './types'
import {
  useLabProductionItems,
  useLabProductionMutation,
  useLabRemakes,
  useLabShipments,
} from './useLabProduction'

const STEP_LABEL = {
  start: 'Start work',
  ship_tryin: 'Ship for try-in',
  finish: 'Send to QC',
  qc: 'QC',
  ship_final: 'Ship',
} as const

const statusText = (s: string) => s.replace(/_/g, ' ')

/**
 * The lab's production desk (lab ERD §14 step 6): the work queue with the
 * next step of every item, shipments to clinics (with the QR slip) and
 * remake requests from clinics.
 */
export function LabProductionPage() {
  const [tab, setTab] = useState('work')
  return (
    <LabPortalLayout
      title="Production"
      subtitle="Work in progress, try-in rounds, QC and shipments to clinics."
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="work">Work queue</TabsTrigger>
          <TabsTrigger value="shipments">Shipments</TabsTrigger>
          <TabsTrigger value="remakes">Remakes</TabsTrigger>
        </TabsList>
        <TabsContent value="work">
          <WorkQueue />
        </TabsContent>
        <TabsContent value="shipments">
          <Shipments />
        </TabsContent>
        <TabsContent value="remakes">
          <Remakes />
        </TabsContent>
      </Tabs>
    </LabPortalLayout>
  )
}

function WorkQueue() {
  const { isLabAdmin } = useActiveLab()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const query = useDebounce(search, 300).trim()
  const params = {
    search: query || undefined,
    status: status === 'all' ? undefined : status,
    page,
    limit,
  }
  const { data, isLoading, isError, refetch, isFetching } =
    useLabProductionItems(params)
  const [shipping, setShipping] = useState<string[] | null>(null)
  const [assigning, setAssigning] = useState<LabProductionItem | null>(null)
  const [failing, setFailing] = useState<LabProductionItem | null>(null)

  const step = useLabProductionMutation(
    ({
      item,
      action,
    }: {
      item: LabProductionItem
      action: 'start' | 'finish' | 'pass'
    }) =>
      action === 'pass'
        ? labProductionApi.qc(item.id, { result: 'pass' })
        : labProductionApi[action](item.id),
    ({ action }) =>
      action === 'start'
        ? 'Work started'
        : action === 'finish'
          ? 'Sent to QC'
          : 'QC passed — ready to ship',
  )
  const fail = useLabProductionMutation(
    (v: { item: LabProductionItem; notes: string }) =>
      labProductionApi.qc(v.item.id, { result: 'fail', notes: v.notes }),
    'QC failed — back to production',
  )
  const dispatch = useLabProductionMutation(
    (v: {
      itemIds: string[]
      courierName: string
      trackingNo: string
      notes: string
    }) =>
      labProductionApi.dispatch({
        lines: v.itemIds.map((itemId) => ({ itemId })),
        courierName: v.courierName || undefined,
        trackingNo: v.trackingNo || undefined,
        notes: v.notes || undefined,
      }),
    'Shipment dispatched',
  )
  const assign = useLabProductionMutation(
    (v: { item: LabProductionItem; labMemberId: string }) =>
      labProductionApi.assign(v.item.id, v.labMemberId),
    'Technician assigned',
  )

  const activeFilters = (query ? 1 : 0) + (status !== 'all' ? 1 : 0)
  const clear = () => {
    setSearch('')
    setStatus('all')
    setPage(1)
  }
  const busy = (i: LabProductionItem) =>
    step.isPending && step.variables.item.id === i.id

  const actions = (i: LabProductionItem) => {
    const next = nextLabStep(i)
    return (
      <div className="flex items-center justify-end gap-1">
        {next === 'qc' ? (
          <>
            <Button
              size="sm"
              disabled={busy(i)}
              onClick={() => step.mutate({ item: i, action: 'pass' })}
            >
              {busy(i) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ClipboardCheck className="size-4" />
              )}
              QC pass
            </Button>
            <TooltipButton
              tooltip="QC fail — back to production"
              size="icon"
              variant="outline"
              onClick={() => setFailing(i)}
            >
              <X className="size-4" />
            </TooltipButton>
          </>
        ) : next === 'ship_tryin' || next === 'ship_final' ? (
          <Button size="sm" onClick={() => setShipping([i.id])}>
            <Truck className="size-4" /> {STEP_LABEL[next]}
          </Button>
        ) : next ? (
          <Button
            size="sm"
            disabled={busy(i)}
            onClick={() => step.mutate({ item: i, action: next })}
          >
            {busy(i) ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {STEP_LABEL[next]}
          </Button>
        ) : null}
        {isLabAdmin && (
          <TooltipButton
            tooltip="Assign technician"
            size="icon"
            variant="ghost"
            onClick={() => setAssigning(i)}
          >
            <UserCog className="size-4" />
          </TooltipButton>
        )}
      </div>
    )
  }

  const stageText = (i: LabProductionItem) =>
    i.activeStage
      ? `${i.activeStage.name}${i.activeStage.roundNo > 1 ? ` · round ${i.activeStage.roundNo}` : ''} · ${statusText(i.activeStage.status)}`
      : i.stageCount
        ? 'Stages done'
        : '—'

  const columns = useMemo<ColumnDef<LabProductionItem, unknown>[]>(
    () => [
      {
        id: 'order',
        header: 'Order',
        accessorFn: (i) => `${i.orderNo}/${i.lineNo}`,
        cell: ({ row: { original: i } }) => (
          <div>
            <p className="text-sm font-semibold">
              {i.orderNo} / {i.lineNo}
              {i.priority === 'urgent' && (
                <Badge variant="warning" className="ml-2">
                  Urgent
                </Badge>
              )}
              {i.remakeOfItemId && (
                <Badge variant="danger" className="ml-2">
                  Remake
                </Badge>
              )}
            </p>
            <p className="text-xs text-text-3">
              {i.clinic.name} · {i.patient.ref}
            </p>
          </div>
        ),
      },
      {
        id: 'work',
        header: 'Work',
        accessorFn: (i) => i.serviceName ?? '',
        cell: ({ row: { original: i } }) => (
          <span className="text-sm">
            {i.serviceName} × {i.quantity}
          </span>
        ),
      },
      {
        id: 'stage',
        header: 'Stage',
        accessorFn: (i) => i.activeStage?.name ?? '',
        cell: ({ row: { original: i } }) => (
          <span className="text-sm text-text-2">{stageText(i)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row: { original: i } }) => (
          <StatusBadge status={i.status} label={statusText(i.status)} />
        ),
      },
      {
        id: 'due',
        header: 'Due',
        accessorFn: (i) => i.labExpectedOn ?? '',
        cell: ({ row: { original: i } }) => (
          <span className="text-sm tabular-nums">{i.labExpectedOn ?? '—'}</span>
        ),
      },
      {
        id: 'tech',
        header: 'Technician',
        accessorFn: (i) => i.assignee?.name ?? '',
        cell: ({ row: { original: i } }) => (
          <span className="text-sm text-text-2">{i.assignee?.name ?? '—'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row: { original: i } }) => actions(i),
      },
    ],
    [step.isPending, isLabAdmin],
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShipping([])}>
          <Truck className="size-4" /> New shipment
        </Button>
      </div>
      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder="Search order no., clinic or work…"
        activeFilters={activeFilters}
        onClear={clear}
        resultLabel={
          isFetching && !isLoading
            ? 'Updating…'
            : `${total} item${total === 1 ? '' : 's'}`
        }
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PRODUCTION_STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : rows.length === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={Factory}
          title="No work yet"
          description="Accepted orders show up here, item by item, with their next step."
        />
      ) : rows.length === 0 ? (
        <NoResultsState
          message="No items match your filters."
          onClear={clear}
        />
      ) : viewMode === 'table' ? (
        <DataTable columns={columns} data={rows} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((i) => (
            <div
              key={i.id}
              className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {i.orderNo} / {i.lineNo} · {i.serviceName}
                  </p>
                  <p className="text-xs text-text-3">
                    {i.clinic.name} · {i.patient.ref}
                  </p>
                </div>
                <StatusBadge status={i.status} label={statusText(i.status)} />
              </div>
              <p className="text-xs text-text-2">Stage: {stageText(i)}</p>
              <p className="text-xs text-text-2">
                Due {i.labExpectedOn ?? '—'} ·{' '}
                {i.assignee?.name ?? 'Unassigned'}
              </p>
              {actions(i)}
            </div>
          ))}
        </div>
      )}
      {total > 0 && (
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l)
            setPage(1)
          }}
        />
      )}

      <DispatchSheet
        open={shipping !== null}
        initialItemIds={shipping ?? []}
        onOpenChange={(o) => !o && setShipping(null)}
        onSubmit={async (v) => {
          const s = await dispatch.mutateAsync(v)
          void printShipmentSlip(s)
        }}
      />
      <AssignSheet
        item={assigning}
        onOpenChange={(o) => !o && setAssigning(null)}
        onSubmit={(labMemberId) =>
          assign.mutateAsync({ item: assigning!, labMemberId })
        }
      />
      <ReasonDialog
        open={!!failing}
        onOpenChange={(o) => !o && setFailing(null)}
        title="QC failed"
        description="The item goes back to production. Say what needs fixing."
        confirmLabel="Fail QC"
        destructive
        isLoading={fail.isPending}
        onConfirm={(notes) =>
          fail.mutate(
            { item: failing!, notes },
            { onSuccess: () => setFailing(null) },
          )
        }
      />
    </div>
  )
}

function Shipments() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const { data, isLoading, isError, refetch, isFetching } = useLabShipments({
    status: status === 'all' ? undefined : status,
    page,
    limit,
  })
  const [losing, setLosing] = useState<Shipment | null>(null)
  const lost = useLabProductionMutation(
    (v: { shipment: Shipment; reason: string }) =>
      labProductionApi.lost(v.shipment.id, v.reason),
    'Shipment marked lost — ship the work again',
  )
  const receive = useLabProductionMutation(
    (s: Shipment) =>
      labProductionApi.receive(
        s.id,
        s.lines
          .filter((l) => !l.condition)
          .map((l) => ({
            shipmentItemId: l.id,
            receivedQty: l.quantity,
            condition: 'ok' as const,
          })),
      ),
    'Received from the clinic',
  )
  const q = useDebounce(search, 300).trim().toLowerCase()
  const rows = (data?.data ?? []).filter(
    (s) =>
      !q ||
      s.shipmentNo.toLowerCase().includes(q) ||
      s.clinic.name.toLowerCase().includes(q),
  )
  const activeFilters = (q ? 1 : 0) + (status !== 'all' ? 1 : 0)
  const clear = () => {
    setSearch('')
    setStatus('all')
  }
  const open = (s: Shipment) =>
    s.status === 'dispatched' || s.status === 'partially_received'

  const actions = (s: Shipment) => (
    <div className="flex items-center justify-end gap-1">
      {s.direction === 'to_lab' && open(s) && (
        <Button
          size="sm"
          disabled={receive.isPending}
          onClick={() => receive.mutate(s)}
        >
          {receive.isPending && <Loader2 className="size-4 animate-spin" />}
          Receive
        </Button>
      )}
      {s.direction === 'to_clinic' && (
        <TooltipButton
          tooltip="Print slip with QR"
          size="icon"
          variant="ghost"
          onClick={() => void printShipmentSlip(s)}
        >
          <Printer className="size-4" />
        </TooltipButton>
      )}
      {open(s) && (
        <TooltipButton
          tooltip="Mark lost"
          size="icon"
          variant="ghost"
          onClick={() => setLosing(s)}
        >
          <PackageX className="size-4" />
        </TooltipButton>
      )}
    </div>
  )

  const columns: ColumnDef<Shipment, unknown>[] = [
    {
      id: 'no',
      header: 'Shipment',
      accessorKey: 'shipmentNo',
      cell: ({ row: { original: s } }) => (
        <div>
          <p className="text-sm font-semibold">{s.shipmentNo}</p>
          <p className="text-xs text-text-3">
            {s.direction === 'to_clinic' ? 'To' : 'From'} {s.clinic.name}
          </p>
        </div>
      ),
    },
    {
      id: 'lines',
      header: 'Contents',
      accessorFn: (s) => s.lines.length,
      cell: ({ row: { original: s } }) => (
        <span className="text-sm text-text-2">
          {s.lines
            .map((l) => `${l.orderNo}/${l.lineNo} ${l.stageName ?? l.contents}`)
            .join(', ')}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row: { original: s } }) => (
        <StatusBadge
          status={s.status}
          label={SHIPMENT_STATUS_LABEL[s.status]}
        />
      ),
    },
    {
      id: 'when',
      header: 'Dispatched',
      accessorKey: 'dispatchedAt',
      cell: ({ row: { original: s } }) => (
        <span className="text-sm tabular-nums">
          {formatInClinic(s.dispatchedAt, 'dd/MM/yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: s } }) => actions(s),
    },
  ]

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search shipment no. or clinic…"
        activeFilters={activeFilters}
        onClear={clear}
        resultLabel={
          isFetching && !isLoading ? 'Updating…' : `${rows.length} shown`
        }
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(SHIPMENT_STATUS_LABEL).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : rows.length === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Ship try-in or finished work from the work queue."
        />
      ) : rows.length === 0 ? (
        <NoResultsState
          message="No shipments match your filters."
          onClear={clear}
        />
      ) : viewMode === 'table' ? (
        <DataTable columns={columns} data={rows} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => (
            <div
              key={s.id}
              className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">
                  {s.shipmentNo} · {s.direction === 'to_clinic' ? 'to' : 'from'}{' '}
                  {s.clinic.name}
                </p>
                <StatusBadge
                  status={s.status}
                  label={SHIPMENT_STATUS_LABEL[s.status]}
                />
              </div>
              <ul className="text-xs text-text-2">
                {s.lines.map((l) => (
                  <li key={l.id}>
                    {l.orderNo}/{l.lineNo} {l.serviceName} —{' '}
                    {l.stageName ?? l.contents}
                    {l.condition ? ` · ${l.condition}` : ''}
                  </li>
                ))}
              </ul>
              {actions(s)}
            </div>
          ))}
        </div>
      )}
      {(data?.total ?? 0) > 0 && (
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / limit))}
          limit={limit}
          total={data?.total ?? 0}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l)
            setPage(1)
          }}
        />
      )}
      <ReasonDialog
        open={!!losing}
        onOpenChange={(o) => !o && setLosing(null)}
        title={`Mark ${losing?.shipmentNo ?? ''} lost`}
        description="Open lines become missing. The work stays owed — ship it again in a new shipment."
        confirmLabel="Mark lost"
        destructive
        isLoading={lost.isPending}
        onConfirm={(reason) =>
          lost.mutate(
            { shipment: losing!, reason },
            { onSuccess: () => setLosing(null) },
          )
        }
      />
    </div>
  )
}

function Remakes() {
  const { isLabAdmin } = useActiveLab()
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const { data, isLoading, isError, refetch } = useLabRemakes(
    status === 'all' ? undefined : status,
  )
  const [disputing, setDisputing] = useState<RemakeRequest | null>(null)
  const dispute = useLabProductionMutation(
    (v: { remake: RemakeRequest; note: string }) =>
      labProductionApi.dispute(v.remake.id, v.remake.version, v.note),
    'Dispute sent to the clinic',
  )
  const q = useDebounce(search, 300).trim().toLowerCase()
  const rows = (data ?? []).filter(
    (r) =>
      !q ||
      (r.orderNo ?? '').toLowerCase().includes(q) ||
      r.clinic.name.toLowerCase().includes(q),
  )
  const activeFilters = (q ? 1 : 0) + (status !== 'all' ? 1 : 0)
  const clear = () => {
    setSearch('')
    setStatus('all')
  }
  const disputeButton = (r: RemakeRequest) =>
    isLabAdmin && r.status === 'requested' ? (
      <Button size="sm" variant="outline" onClick={() => setDisputing(r)}>
        Dispute
      </Button>
    ) : null

  const columns: ColumnDef<RemakeRequest, unknown>[] = [
    {
      id: 'order',
      header: 'Order',
      accessorFn: (r) => r.orderNo ?? '',
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="text-sm font-semibold">
            {r.orderNo} / {r.originalLineNo} · {r.serviceName}
          </p>
          <p className="text-xs text-text-3">{r.clinic.name}</p>
        </div>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      accessorKey: 'reasonCode',
      cell: ({ row: { original: r } }) => (
        <span className="text-sm">
          {REMAKE_REASON_LABEL[r.reasonCode]}
          {r.isWarrantyClaim && ' · warranty'}
          {r.notes && (
            <span className="block text-xs text-text-3">{r.notes}</span>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row: { original: r } }) => <StatusBadge status={r.status} />,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: r } }) => disputeButton(r),
    },
  ]

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search order no. or clinic…"
        activeFilters={activeFilters}
        onClear={clear}
        resultLabel={`${rows.length} request${rows.length === 1 ? '' : 's'}`}
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {['requested', 'disputed', 'agreed', 'closed'].map((s) => (
                <SelectItem key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : rows.length === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No remake requests"
          description="When a clinic rejects work or claims a warranty, the request shows up here."
        />
      ) : rows.length === 0 ? (
        <NoResultsState
          message="No requests match your filters."
          onClear={clear}
        />
      ) : viewMode === 'table' ? (
        <DataTable columns={columns} data={rows} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">
                  {r.orderNo} / {r.originalLineNo} · {r.serviceName}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-text-2">
                {r.clinic.name} · {REMAKE_REASON_LABEL[r.reasonCode]}
                {r.isWarrantyClaim && ' · warranty claim'}
              </p>
              {r.notes && <p className="text-xs text-text-3">{r.notes}</p>}
              {r.status === 'agreed' && (
                <p className="text-xs text-text-2">
                  Responsible: {r.responsibleParty} · new line {r.newLineNo}
                </p>
              )}
              {disputeButton(r)}
            </div>
          ))}
        </div>
      )}
      <ReasonDialog
        open={!!disputing}
        onOpenChange={(o) => !o && setDisputing(null)}
        title="Dispute remake request"
        description="Tell the clinic why the lab isn’t responsible. They decide who pays."
        confirmLabel="Send dispute"
        isLoading={dispute.isPending}
        onConfirm={(note) =>
          dispute.mutate(
            { remake: disputing!, note },
            { onSuccess: () => setDisputing(null) },
          )
        }
      />
    </div>
  )
}
