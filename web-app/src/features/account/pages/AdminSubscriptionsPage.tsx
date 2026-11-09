import { useEffect, useMemo, useState } from 'react'
import { CollapsibleFilters } from '@/components/shared/CollapsibleFilters'
import { useForm, useStore } from '@tanstack/react-form'
import type { ColumnDef } from '@/components/shared/table-features'
import {
  Building2,
  Clock,
  FileText,
  Loader2,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
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
import { fieldError } from '@/components/forms/fieldError'
import { paymentInstructionsSchema } from '../schemas/account.schema'
import {
  useAdminSubscriptions,
  usePaymentInstructions,
  useSavePaymentInstructions,
} from '../hooks/useAccount'
import { ManageSubscriptionSheet } from '../components/ManageSubscriptionSheet'
import { formatDay } from './SubscriptionPage'
import { Badge } from '@/components/ui/badge'
import { ClinicApprovalSheet } from '@/features/clinic-access'
import type { ApprovalTarget } from '@/features/clinic-access'
import { APPROVAL_LABEL, STATUS_LABEL, STATUS_TONE } from '../types'
import type {
  AdminSubscriptionRow,
  ClinicApproval,
  SubscriptionStatus,
} from '../types'

type StatusFilter = SubscriptionStatus | 'all'
type ApprovalFilter = ClinicApproval | 'all'

const APPROVAL_VARIANT = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
} as const

function ApprovalBadge({ status }: { status: ClinicApproval }) {
  return (
    <Badge variant={APPROVAL_VARIANT[status]}>{APPROVAL_LABEL[status]}</Badge>
  )
}

const toTarget = (r: AdminSubscriptionRow): ApprovalTarget => ({
  id: r.organization.id,
  name: r.organization.name,
  email: r.organization.email,
  phone: r.organization.phone,
  createdAt: r.createdAt,
  status: r.approval.status,
  note: r.approval.note,
})

function PaymentInstructionsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const current = usePaymentInstructions()
  const save = useSavePaymentInstructions()
  const saved = current.data?.text ?? ''
  const form = useForm({
    defaultValues: { text: saved },
    validators: {
      onChange: paymentInstructionsSchema,
      onSubmit: paymentInstructionsSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync(value.text)
        toast.success('Payment instructions saved')
        onOpenChange(false)
      } catch {
        toast.error('Could not save. Try again.')
      }
    },
  })
  const [canSubmit, isSubmitting, value] = useStore(
    form.store,
    (s) => [s.canSubmit, s.isSubmitting, s.values.text] as const,
  )
  const dirty = value !== saved

  // Start from the saved text every time the sheet opens (or it loads).
  useEffect(() => {
    if (open) form.reset({ text: saved })
  }, [open, saved, form])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Payment instructions"
      description="Shown to every clinic owner on Plan & billing — bank account, JazzCash number, who to send the receipt to."
      submitLabel="Save"
      isSubmitting={save.isPending || isSubmitting}
      submitDisabled={!dirty || !canSubmit}
      onSubmit={() => void form.handleSubmit()}
    >
      {current.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : current.isError ? (
        <ErrorState onRetry={() => void current.refetch()} />
      ) : (
        <form.Field name="text">
          {(field) => (
            <FieldWrapper
              label="Instructions"
              htmlFor="pay-instructions"
              error={fieldError(field)}
              hint={dirty ? 'Unsaved changes' : undefined}
            >
              <Textarea
                id="pay-instructions"
                rows={8}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      )}
    </FormSheet>
  )
}

function ClinicCard({
  row,
  onManage,
  onReview,
}: {
  row: AdminSubscriptionRow
  onManage: () => void
  onReview: () => void
}) {
  const approval = row.approval.status
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.organization.name}</p>
          <p className="text-sm text-muted-foreground">{row.plan.name} plan</p>
        </div>
        {approval === 'approved' ? (
          <StatusBadge
            status={row.state.status}
            tone={STATUS_TONE[row.state.status]}
            label={STATUS_LABEL[row.state.status]}
          />
        ) : (
          <ApprovalBadge status={approval} />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {row.state.periodEndsAt
            ? `Ends ${formatDay(row.state.periodEndsAt)}`
            : 'No end date'}
        </span>
        <div className="flex gap-2">
          {approval !== 'approved' && (
            <Button size="sm" onClick={onReview}>
              Review
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onManage}>
            Manage
          </Button>
        </div>
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
  const [approval, setApproval] = useState<ApprovalFilter>('all')
  const [reviewing, setReviewing] = useState<ApprovalTarget | null>(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const q = useDebounce(search, 300).trim().toLowerCase()

  const rows = list.data?.clinics ?? []
  const pendingCount = rows.filter(
    (r) => r.approval.status === 'pending',
  ).length
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (!q || r.organization.name.toLowerCase().includes(q)) &&
            (status === 'all' || r.state.status === status) &&
            (approval === 'all' || r.approval.status === approval),
        )
        // Clinics waiting for approval first.
        .sort(
          (a, b) =>
            Number(b.approval.status === 'pending') -
            Number(a.approval.status === 'pending'),
        ),
    [rows, q, status, approval],
  )
  const activeFilters =
    (q ? 1 : 0) + (status !== 'all' ? 1 : 0) + (approval !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setApproval('all')
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
        id: 'approval',
        header: 'Approval',
        accessorFn: (r) => r.approval.status,
        cell: ({ row }) => (
          <ApprovalBadge status={row.original.approval.status} />
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
          <div className="flex justify-end gap-1">
            <TooltipButton
              tooltip={
                row.original.approval.status === 'approved'
                  ? 'Approval: revoke or review'
                  : 'Review sign-up'
              }
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                setReviewing(toTarget(row.original))
              }}
            >
              <ShieldCheck className="size-4" />
            </TooltipButton>
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
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <DashboardLayout
      title="Subscriptions"
      subtitle="Approve new clinics, see every clinic's plan and status, and record payments."
      actions={
        <Button variant="outline" onClick={() => setInstructionsOpen(true)}>
          <FileText className="mr-2 size-4" />
          Payment instructions
        </Button>
      }
    >
      {pendingCount > 0 && approval !== 'pending' && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber bg-amber-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className="size-4 text-amber" />
            {pendingCount} new clinic{pendingCount === 1 ? '' : 's'} waiting for
            approval
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setApproval('pending')}
          >
            Show them
          </Button>
        </div>
      )}

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
        <CollapsibleFilters
          className="w-full sm:contents"
          activeCount={activeFilters}
        >
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
          <Select
            value={approval}
            onValueChange={(v) => setApproval(v as ApprovalFilter)}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Approval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any approval</SelectItem>
              {(Object.keys(APPROVAL_LABEL) as ClinicApproval[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {APPROVAL_LABEL[a]}
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
        </CollapsibleFilters>
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
              onReview={() => setReviewing(toTarget(r))}
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
      <ClinicApprovalSheet
        clinic={reviewing}
        onClose={() => setReviewing(null)}
      />
      {list.isFetching && !list.isLoading && (
        <Loader2 className="fixed bottom-4 right-4 size-4 animate-spin text-muted-foreground" />
      )}
    </DashboardLayout>
  )
}
