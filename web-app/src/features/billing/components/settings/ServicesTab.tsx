import { useEffect, useMemo, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2, Pencil, Plus, Stethoscope, Tags, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/DataTable'
import { SectionHeading } from '../shared/billing-ui'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FormSheet } from '@/components/forms/FormSheet'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { useDoctors } from '@/features/appointments'
import { fieldError } from '@/features/queue/utils/fieldError'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import {
  useCatalogServices,
  useServicePrices,
} from '../../hooks/use-billing-queries'
import { serviceSchema, toAmount } from '../../schemas/billing.schema'
import type { ServiceValues } from '../../schemas/billing.schema'
import { configApi } from '../../services/billing-v2.api'
import type {
  CatalogService,
  ServicePriceOverride,
} from '../../types/billing.types'
import { Money } from '../shared/billing-badges'
import { OptionSelect } from '../shared/OptionSelect'

const KIND_LABEL = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  OTHER: 'Other',
} as const
const EMPTY: ServiceValues = {
  name: '',
  code: '',
  kind: 'PROCEDURE',
  defaultPrice: '',
  sortOrder: 0,
}

/** Org catalog + this location's price overrides (D5). Admin only. */
const activeSwitch = (
  label: string,
  checked: boolean,
  onChange: () => void,
  tip: string,
) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Switch
            size="sm"
            checked={checked}
            onCheckedChange={onChange}
            aria-label={label}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)

const editButton = (tooltip: string, onClick: () => void) => (
  <div className="flex justify-end">
    <TooltipButton
      tooltip={tooltip}
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      onClick={onClick}
    >
      <Pencil className="h-4 w-4 text-muted-foreground" />
    </TooltipButton>
  </div>
)

export function ServicesTab() {
  const services = useCatalogServices()
  const [editing, setEditing] = useState<CatalogService | 'new' | null>(null)
  const toggle = useBillingMutation((s: CatalogService) =>
    configApi.updateService(s.id, { isActive: !s.isActive }),
  )
  const columns = useMemo<ColumnDef<CatalogService, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Service',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">{row.original.name}</p>
            {row.original.code && (
              <p className="font-mono text-[11px] text-muted-foreground">
                {row.original.code}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'kind',
        header: 'Kind',
        cell: ({ row }) => (
          <Badge variant="muted">{KIND_LABEL[row.original.kind]}</Badge>
        ),
      },
      {
        accessorKey: 'defaultPrice',
        header: 'Default price',
        cell: ({ row }) => (
          <Money value={row.original.defaultPrice} className="font-medium" />
        ),
      },
      {
        id: 'active',
        header: 'Active',
        enableSorting: false,
        cell: ({ row }) =>
          activeSwitch(
            `${row.original.isActive ? 'Deactivate' : 'Activate'} ${row.original.name}`,
            row.original.isActive,
            () => toggle.mutate(row.original),
            row.original.isActive
              ? 'Offered — click to stop offering'
              : 'Not offered — click to offer',
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          editButton('Edit service', () => setEditing(row.original)),
      },
    ],
    [toggle],
  )

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <SectionHeading
          icon={Stethoscope}
          title="Service catalog"
          description="Organization-wide services and default prices"
          actions={
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="size-3.5" /> Add service
            </Button>
          }
        />
        {services.isLoading ? (
          <LoadingSkeleton variant="table" />
        ) : services.isError ? (
          <ErrorState onRetry={() => void services.refetch()} />
        ) : !services.data?.length ? (
          <EmptyState
            icon={Stethoscope}
            title="No services yet"
            description="Add a consultation fee and your procedures with default prices."
            action={
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus className="size-3.5" /> Add service
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={services.data}
            emptyMessage="No services."
          />
        )}
      </section>
      <PriceOverrides services={services.data ?? []} />
      <ServiceSheet service={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ServiceSheet({
  service,
  onClose,
}: {
  service: CatalogService | 'new' | null
  onClose: () => void
}) {
  const isNew = service === 'new'
  const save = useBillingMutation(
    (v: ServiceValues) => {
      const body = {
        name: v.name,
        code: v.code || undefined,
        kind: v.kind,
        defaultPrice: toAmount(v.defaultPrice),
        sortOrder: v.sortOrder,
      }
      return isNew || !service
        ? configApi.createService(body)
        : configApi.updateService(service.id, body)
    },
    { success: 'Service saved' },
  )
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onChange: serviceSchema, onSubmit: serviceSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value)
      onClose()
    },
  })
  useEffect(() => {
    if (!service) return
    form.reset(
      service === 'new'
        ? EMPTY
        : {
            name: service.name,
            code: service.code ?? '',
            kind: service.kind,
            defaultPrice: String(service.defaultPrice),
            sortOrder: service.sortOrder,
          },
    )
  }, [service, form])

  return (
    <FormSheet
      open={!!service}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Add service' : 'Edit service'}
      description="Price changes never touch charges already created."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}{' '}
                Save
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-4">
        <form.Field name="name">
          {(f) => (
            <FieldWrapper
              label="Name"
              htmlFor="svc-name"
              required
              error={fieldError(f)}
            >
              <Input
                id="svc-name"
                dir="auto"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="code">
            {(f) => (
              <FieldWrapper
                label="Code"
                htmlFor="svc-code"
                error={fieldError(f)}
              >
                <Input
                  id="svc-code"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value.toUpperCase())}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="kind">
            {(f) => (
              <FieldWrapper label="Kind" required>
                <OptionSelect
                  options={Object.entries(KIND_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={f.state.value}
                  onChange={(v) => f.handleChange(v as ServiceValues['kind'])}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <form.Field name="defaultPrice">
          {(f) => (
            <FieldWrapper
              label="Default price (Rs)"
              htmlFor="svc-price"
              required
              error={fieldError(f)}
            >
              <Input
                id="svc-price"
                inputMode="decimal"
                className="tabular-nums"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </div>
    </FormSheet>
  )
}

/** Location price and per-doctor price overrides (D5 resolution order). */
function PriceOverrides({ services }: { services: CatalogService[] }) {
  const prices = useServicePrices()
  const doctors = useDoctors()
  const [draft, setDraft] = useState({ serviceId: '', doctorId: '', price: '' })
  const [removing, setRemoving] = useState<ServicePriceOverride | null>(null)
  const create = useBillingMutation(
    () =>
      configApi.createPrice({
        serviceId: draft.serviceId,
        doctorId: draft.doctorId || undefined,
        price: toAmount(draft.price),
      }),
    { success: 'Override saved' },
  )
  const remove = useBillingMutation((id: string) => configApi.deletePrice(id), {
    success: 'Override removed',
  })
  const valid = !!draft.serviceId && /^\d+(\.\d{1,2})?$/.test(draft.price)
  const columns = useMemo<ColumnDef<ServicePriceOverride, unknown>[]>(
    () => [
      {
        accessorKey: 'serviceName',
        header: 'Service',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.serviceName}</span>
        ),
      },
      {
        id: 'doctor',
        header: 'Doctor',
        accessorFn: (r) => r.doctorName ?? '',
        cell: ({ row }) =>
          row.original.doctorName ?? (
            <span className="text-muted-foreground">All doctors</span>
          ),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => (
          <Money value={row.original.price} className="font-medium" />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TooltipButton
              tooltip="Remove override"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setRemoving(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </TooltipButton>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <section className="space-y-2">
      <SectionHeading
        icon={Tags}
        title="Price overrides for this location"
        description="Doctor price → location price → default price"
      />
      <Card className="py-0">
        <CardContent className="flex flex-row flex-wrap items-center gap-3 p-2 px-3">
          <OptionSelect
            className="h-8 w-[200px] text-xs"
            placeholder="Service"
            options={services.map((sv) => ({ value: sv.id, label: sv.name }))}
            value={draft.serviceId}
            onChange={(serviceId) => setDraft((d) => ({ ...d, serviceId }))}
          />
          <OptionSelect
            className="h-8 w-[200px] text-xs"
            options={[
              { value: 'ALL', label: 'All doctors' },
              ...(doctors.data ?? []).map((d) => ({
                value: d.id,
                label: d.fullName,
              })),
            ]}
            value={draft.doctorId || 'ALL'}
            onChange={(v) =>
              setDraft((d) => ({ ...d, doctorId: v === 'ALL' ? '' : v }))
            }
          />
          <Input
            aria-label="Override price"
            placeholder="Price (Rs)"
            inputMode="decimal"
            className="h-8 w-28 text-xs tabular-nums"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={!valid || create.isPending}
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: () =>
                  setDraft({ serviceId: '', doctorId: '', price: '' }),
              })
            }
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add override
          </Button>
        </CardContent>
      </Card>
      <DataTable
        columns={columns}
        data={prices.data ?? []}
        isLoading={prices.isLoading}
        emptyMessage="No overrides — default prices apply."
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove price override?"
        description={
          removing
            ? `${removing.serviceName} (${removing.doctorName ?? 'all doctors'}) falls back to the next price level.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        isLoading={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
        }
      />
    </section>
  )
}
