import { useMemo, useState } from 'react'
import { CollapsibleFilters } from '@/components/shared/CollapsibleFilters'
import { ClipboardList, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { NoResultsState } from '@/components/feedback/NoResultsState'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useCreatePlanTemplate,
  useDeletePlanTemplate,
  usePlanTemplates,
  useUpdatePlanTemplate,
} from '../hooks/usePlanTemplates'
import {
  PLAN_TEMPLATE_CATEGORY_LABELS,
  PLAN_TEMPLATE_CATEGORY_OPTIONS,
} from '../types'
import type { PlanTemplate } from '../types'
import { PlanTemplateForm } from '../components/PlanTemplateForm'
import { formatCurrency } from '@/lib/formatters'
import { planTotals, useServiceCatalog } from '@/features/treatment-plans'

/**
 * The clinic's predefined treatment plans (Root Canal, Implant…). A doctor
 * picks one when starting a plan for a patient. Not to be confused with
 * Prescription Presets, which are sets of medicines.
 */
export function PlanTemplatesPage() {
  const {
    data: templates = [],
    isLoading,
    isError,
    refetch,
  } = usePlanTemplates(true)
  const create = useCreatePlanTemplate()
  const update = useUpdatePlanTemplate()
  const remove = useDeletePlanTemplate()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState<PlanTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<PlanTemplate | null>(null)
  const debounced = useDebounce(search, 300)

  const visible = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return templates.filter(
      (t) =>
        (category === 'all' || t.category === category) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          t.items.some((i) => i.procedureName.toLowerCase().includes(q))),
    )
  }, [templates, debounced, category])

  const activeFilters =
    (debounced.trim() ? 1 : 0) + (category !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setCategory('all')
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Treatment Plan Templates</h1>
          <p className="text-sm text-muted-foreground">
            Ready-made plans like Root Canal or Implant. Doctors pick one when
            starting a plan for a patient.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New template
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates or services…"
            className="pl-9"
          />
        </div>
        <CollapsibleFilters
          className="w-full sm:contents"
          activeCount={activeFilters}
        >
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger
              className="w-full sm:w-64"
              aria-label="Filter by category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PLAN_TEMPLATE_CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <>
              <Badge variant="secondary">
                {activeFilters} filter{activeFilters > 1 ? 's' : ''}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5" /> Clear all filters
              </Button>
            </>
          )}
        </CollapsibleFilters>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="cards" rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No treatment plan templates"
          description="Create one so doctors can start a plan in a single tap."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New template
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <NoResultsState onClear={clearFilters} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              togglePending={update.isPending}
              onToggle={(isActive) =>
                update.mutate({ id: t.id, data: { isActive } })
              }
              onEdit={() => setEditing(t)}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={creating || !!editing}
        onOpenChange={(o) => !o && closeForm()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit template' : 'New treatment plan template'}
            </DialogTitle>
            <DialogDescription>
              The services and discount are copied into a patient&apos;s plan
              when a doctor uses this template. Prices come from the catalog.
            </DialogDescription>
          </DialogHeader>
          <PlanTemplateForm
            key={editing?.id ?? 'new'}
            template={editing}
            isPending={create.isPending || update.isPending}
            onCancel={closeForm}
            onSubmit={(input) => {
              if (editing) {
                update.mutate(
                  { id: editing.id, data: input },
                  { onSuccess: closeForm },
                )
              } else {
                create.mutate(input, { onSuccess: closeForm })
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this template?"
        description={
          <>
            <strong>{deleting?.name}</strong> will be deleted for good. Plans
            already made from it are not affected. To just hide it from doctors,
            switch it off instead.
          </>
        }
        confirmLabel="Delete"
        destructive
        isLoading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </div>
  )
}

function TemplateCard({
  template: t,
  togglePending,
  onToggle,
  onEdit,
  onDelete,
}: {
  template: PlanTemplate
  togglePending: boolean
  onToggle: (isActive: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const sessions = t.items.reduce((n, i) => n + i.estimatedSessions, 0)
  const { data: services = [] } = useServiceCatalog()
  const prices = t.items.map(
    (i) => services.find((s) => s.id === i.serviceId)?.price,
  )
  // Only price viewers get prices; show a total only when every line has one.
  const total = prices.every((p) => p != null)
    ? planTotals(prices, t.discountKind, t.discountValue)
    : null
  const unlinked = t.items.filter((i) => !i.serviceId).length
  return (
    <article
      className={
        t.isActive
          ? 'flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm'
          : 'flex flex-col rounded-lg border border-border bg-card p-4 opacity-60 shadow-sm'
      }
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{t.name}</h2>
          <Badge variant="outline" className="mt-1">
            {PLAN_TEMPLATE_CATEGORY_LABELS[t.category]}
          </Badge>
        </div>
      </div>
      {t.description && (
        <p className="mb-2 text-sm text-muted-foreground">{t.description}</p>
      )}
      <ol className="mb-3 flex-1 list-decimal space-y-0.5 pl-5 text-sm">
        {t.items.map((i, idx) => (
          <li key={idx}>
            {i.procedureName}
            {i.estimatedSessions > 1 && (
              <span className="text-muted-foreground">
                {' '}
                · {i.estimatedSessions} visits
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mb-3 text-xs text-muted-foreground">
        {t.items.length} service{t.items.length === 1 ? '' : 's'} · {sessions}{' '}
        visit{sessions === 1 ? '' : 's'}
        {total && ` · ${formatCurrency(total.final)}`}
        {total &&
          total.discount > 0 &&
          ` (after ${formatCurrency(total.discount)} off)`}
      </p>
      {unlinked > 0 && (
        <p className="mb-3 text-xs text-amber-700 dark:text-amber-200">
          {unlinked} step{unlinked === 1 ? '' : 's'} not linked to a service —
          edit to pick them.
        </p>
      )}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-2 text-xs">
                <Switch
                  checked={t.isActive}
                  disabled={togglePending}
                  onCheckedChange={onToggle}
                  aria-label={t.isActive ? 'Switch off' : 'Switch on'}
                />
                {t.isActive ? 'Active' : 'Hidden'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t.isActive
                ? 'Doctors can pick this template'
                : 'Hidden from doctors'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex">
          <TooltipButton
            tooltip="Edit template"
            variant="ghost"
            size="icon"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </TooltipButton>
          <TooltipButton
            tooltip="Delete template"
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </TooltipButton>
        </div>
      </div>
    </article>
  )
}
