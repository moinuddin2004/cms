import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Building2, FileText, Loader2, Search, Settings2, X } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  DataTable,
  EmptyState,
  ErrorState,
  FieldWrapper,
  FormSheet,
  LoadingSkeleton,
  NoResultsState,
  StatusBadge,
  ViewToggle,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useAdminSubscriptions,
  usePaymentInstructions,
  useSavePaymentInstructions,
} from '../hooks/useAccount'
import { ManageSubscriptionSheet } from '../components/ManageSubscriptionSheet'
import { formatDay } from './SubscriptionPage'
import { STATUS_LABEL, STATUS_TONE } from '../types'
import type { AdminSubscriptionRow, SubscriptionStatus } from '../types'

type StatusFilter = SubscriptionStatus | 'all'

function PaymentInstructionsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const current = usePaymentInstructions()
  const save = useSavePaymentInstructions()
  const [text, setText] = useState<string | null>(null)
  const value = text ?? current.data?.text ?? ''
  const dirty = text != null && text !== current.data?.text
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setText(null)
        onOpenChange(o)
      }}
      title="Payment instructions"
      description="Shown to every clinic owner on Plan & billing — bank account, JazzCash number, who to send the receipt to."
      submitLabel="Save"
      isSubmitting={save.isPending}
      submitDisabled={!dirty || value.length > 2000}
      onSubmit={() =>
        save.mutate(value, {
          onSuccess: () => {
            toast.success('Payment instructions saved')
            setText(null)
            onOpenChange(false)
          },
          onError: () => toast.error('Could not save. Try again.'),
        })
      }
    >
      {current.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : current.isError ? (
        <ErrorState onRetry={() => void current.refetch()} />
      ) : (
        <FieldWrapper
          label="Instructions"
          htmlFor="pay-instructions"
          error={value.length > 2000 ? 'At most 2000 characters' : undefined}
          hint={dirty ? 'Unsaved changes' : undefined}
        >
          <Textarea
            id="pay-instructions"
            rows={8}
            value={value}
            onChange={(e) => setText(e.target.value)}
          />
        </FieldWrapper>
      )}
    </FormSheet>
  )
}

function ClinicCard({
  row,
  onManage,
}: {
  row: AdminSubscriptionRow
  onManage: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.organization.name}</p>
          <p className="text-sm text-muted-foreground">{row.plan.name} plan</p>
        </div>
        <StatusBadge
          status={row.state.status}
          tone={STATUS_TONE[row.state.status]}
          label={STATUS_LABEL[row.state.status]}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {row.state.periodEndsAt
            ? `Ends ${formatDay(row.state.periodEndsAt)}`
            : 'No end date'}
        </span>
        <Button size="sm" variant="outline" onClick={onManage}>
          Manage
        </Button>
      </div>
    </div>
  )
}

/** Super admin: every clinic's plan and status; record payments. */
export function AdminSubscriptionsPage() {
  const list = useAdminSubscriptions()
  const [view, setView] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [managing, setManaging] = useState<string | null>(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const q = useDebounce(search, 300).trim().toLowerCase()

  const rows = list.data?.clinics ?? []
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || r.organization.name.toLowerCase().includes(q)) &&
          (status === 'all' || r.state.status === status),
      ),
    [rows, q, status],
  )
  const activeFilters = (q ? 1 : 0) + (status !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
  }

  const columns = useMemo<ColumnDef<AdminSubscriptionRow, unknown>[]>(
    () => [
      {
        id: 'clinic',
        header: 'Clinic',
        accessorFn: (r) => r.organization.name,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.organization.name}
            {!row.original.organization.isActive && (
              <span className="ml-2 text-xs text-muted-foreground">
                (inactive)
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        accessorFn: (r) => r.plan.name,
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.state.status,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.state.status}
            tone={STATUS_TONE[row.original.state.status]}
            label={STATUS_LABEL[row.original.state.status]}
          />
        ),
      },
      {
        id: 'ends',
        header: 'Period ends',
        accessorFn: (r) => r.state.periodEndsAt ?? '',
        cell: ({ row }) => formatDay(row.original.state.periodEndsAt),
      },
      {
        id: 'daysLeft',
        header: 'Days left',
        accessorFn: (r) => r.state.daysLeft ?? Number.POSITIVE_INFINITY,
        cell: ({ row }) => row.original.state.daysLeft ?? '—',
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <TooltipButton
            tooltip="Manage subscription"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setManaging(row.original.organization.id)
            }}
          >
            <Settings2 className="size-4" />
          </TooltipButton>
        ),
      },
    ],
    [],
  )

  return (
    <DashboardLayout
      title="Subscriptions"
      subtitle="Every clinic's plan and status. Record payments clinics send you."
      actions={
        <Button variant="outline" onClick={() => setInstructionsOpen(true)}>
          <FileText className="mr-2 size-4" />
          Payment instructions
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clinics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABEL) as SubscriptionStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 size-4" />
            Clear all filters
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
              {activeFilters}
            </span>
          </Button>
        )}
        <ViewToggle value={view} onChange={setView} className="sm:ml-auto" />
      </div>

      {list.isLoading ? (
        <LoadingSkeleton variant={view === 'card' ? 'cards' : 'table'} />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clinics yet"
          description="Clinics appear here when they sign up or are created."
        />
      ) : filtered.length === 0 ? (
        <NoResultsState onClear={clearFilters} />
      ) : view === 'table' ? (
        <DataTable
          columns={columns}
          data={filtered}
          pagination
          onRowClick={(r) => setManaging(r.organization.id)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <ClinicCard
              key={r.organization.id}
              row={r}
              onManage={() => setManaging(r.organization.id)}
            />
          ))}
        </div>
      )}

      <ManageSubscriptionSheet
        orgId={managing}
        onOpenChange={(o) => !o && setManaging(null)}
      />
      <PaymentInstructionsSheet
        open={instructionsOpen}
        onOpenChange={setInstructionsOpen}
      />
      {list.isFetching && !list.isLoading && (
        <Loader2 className="fixed bottom-4 right-4 size-4 animate-spin text-muted-foreground" />
      )}
    </DashboardLayout>
  )
}
