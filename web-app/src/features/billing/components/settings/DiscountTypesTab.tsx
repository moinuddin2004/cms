import { useEffect, useMemo, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2, Pencil, Percent, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MultiSelect } from '@/components/shared/MultiSelect'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { ColumnDef } from '@/components/shared/table-features'
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
import { DatePicker } from '@/components/shared/DatePicker'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { fieldError } from '@/features/queue/utils/fieldError'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import {
  useCatalogServices,
  useDiscountTypes,
} from '../../hooks/use-billing-queries'
import { discountTypeSchema, toAmount } from '../../schemas/billing.schema'
import type { DiscountTypeValues } from '../../schemas/billing.schema'
import { configApi } from '../../services/billing-v2.api'
import type { DiscountTypeInput } from '../../services/billing-v2.api'
import type { DiscountType, ServiceKind } from '../../types/billing.types'
import { OptionSelect } from '../shared/OptionSelect'
import { activeCurrency } from '@/lib/currency'

const EMPTY: DiscountTypeValues = {
  name: '',
  code: '',
  kind: 'PERCENTAGE',
  value: '',
  maxAmount: '',
  appliesTo: 'ALL',
  serviceKinds: [],
  serviceIds: [],
  receptionEditable: false,
  minValue: '',
  maxValue: '',
  requiresNote: false,
  validFrom: '',
  validTo: '',
}
const KINDS: ServiceKind[] = ['CONSULTATION', 'PROCEDURE', 'OTHER']
const nullable = (v: string) => (v === '' ? null : toAmount(v))

function toInput(v: DiscountTypeValues): DiscountTypeInput {
  return {
    name: v.name,
    code: v.code || null,
    kind: v.kind,
    value: toAmount(v.value),
    maxAmount: nullable(v.maxAmount),
    appliesTo: v.appliesTo,
    serviceKinds: v.appliesTo === 'SERVICE_KINDS' ? v.serviceKinds : null,
    serviceIds: v.appliesTo === 'SERVICES' ? v.serviceIds : null,
    receptionEditable: v.receptionEditable,
    minValue: v.receptionEditable ? nullable(v.minValue) : null,
    maxValue: v.receptionEditable ? nullable(v.maxValue) : null,
    requiresNote: v.requiresNote,
    validFrom: v.validFrom || null,
    validTo: v.validTo || null,
  }
}

const describe = (t: DiscountType) =>
  t.kind === 'PERCENTAGE' ? `${t.value}%` : `${activeCurrency()} ${t.value}`

/** Owner-defined discount presets (D8). Admin only. */
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

export function DiscountTypesTab() {
  const types = useDiscountTypes()
  const [editing, setEditing] = useState<DiscountType | 'new' | null>(null)
  const toggle = useBillingMutation((t: DiscountType) =>
    configApi.updateDiscountType(t.id, { isActive: !t.isActive }),
  )
  const columns = useMemo<ColumnDef<DiscountType, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            {row.original.name}
            {row.original.requiresNote && (
              <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                Note
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: 'value',
        header: 'Value',
        accessorFn: (t) => t.value,
        cell: ({ row }) => (
          <span>
            {describe(row.original)}
            {row.original.maxAmount ? (
              <span className="text-xs text-muted-foreground">
                {' '}
                · max {activeCurrency()} {row.original.maxAmount}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'appliesTo',
        header: 'Applies to',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.appliesTo === 'ALL'
              ? 'Everything'
              : row.original.appliesTo === 'SERVICE_KINDS'
                ? (row.original.serviceKinds ?? [])
                    .map((k) => k.toLowerCase())
                    .join(', ')
                : `${row.original.serviceIds?.length ?? 0} services`}
          </span>
        ),
      },
      {
        id: 'range',
        header: 'Reception',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.receptionEditable ? (
            <Badge variant="info" className="px-1.5 py-0 text-[10px]">
              {row.original.minValue}–{row.original.maxValue}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Fixed</span>
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
              ? 'Usable — click to deactivate'
              : 'Inactive — click to activate',
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          editButton('Edit discount type', () => setEditing(row.original)),
      },
    ],
    [toggle],
  )

  return (
    <section className="space-y-2">
      <SectionHeading
        icon={Percent}
        title="Discount types"
        description="Presets reception can apply; custom discounts stay admin-only"
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" /> Add discount type
          </Button>
        }
      />
      {types.isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : types.isError ? (
        <ErrorState onRetry={() => void types.refetch()} />
      ) : !types.data?.length ? (
        <EmptyState
          icon={Percent}
          title="No discount types"
          description="E.g. Staff family 20%, Senior citizen 10%, a fixed amount off."
          action={
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="size-3.5" /> Add discount type
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={types.data} />
      )}
      <DiscountTypeSheet type={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

function DiscountTypeSheet({
  type,
  onClose,
}: {
  type: DiscountType | 'new' | null
  onClose: () => void
}) {
  const isNew = type === 'new'
  const services = useCatalogServices({ activeOnly: true })
  const save = useBillingMutation(
    (v: DiscountTypeValues) =>
      isNew || !type
        ? configApi.createDiscountType(toInput(v))
        : configApi.updateDiscountType(type.id, toInput(v)),
    { success: 'Discount type saved' },
  )
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onChange: discountTypeSchema, onSubmit: discountTypeSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value)
      onClose()
    },
  })
  useEffect(() => {
    if (!type) return
    const s = (n: number | null) => (n == null ? '' : String(n))
    form.reset(
      type === 'new'
        ? EMPTY
        : {
            name: type.name,
            code: type.code ?? '',
            kind: type.kind,
            value: String(type.value),
            maxAmount: s(type.maxAmount),
            appliesTo: type.appliesTo,
            serviceKinds: type.serviceKinds ?? [],
            serviceIds: type.serviceIds ?? [],
            receptionEditable: type.receptionEditable,
            minValue: s(type.minValue),
            maxValue: s(type.maxValue),
            requiresNote: type.requiresNote,
            validFrom: type.validFrom ?? '',
            validTo: type.validTo ?? '',
          },
    )
  }, [type, form])

  const amount = (
    name: 'value' | 'maxAmount' | 'minValue' | 'maxValue',
    label: string,
    required = false,
  ) => (
    <form.Field name={name}>
      {(f) => (
        <FieldWrapper
          label={label}
          htmlFor={`dt-${name}`}
          required={required}
          error={fieldError(f)}
        >
          <Input
            id={`dt-${name}`}
            inputMode="decimal"
            className="tabular-nums"
            value={f.state.value}
            onChange={(e) => f.handleChange(e.target.value)}
            onBlur={f.handleBlur}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )
  const flag = (name: 'receptionEditable' | 'requiresNote', label: string) => (
    <form.Field name={name}>
      {(f) => (
        <label className="flex items-center justify-between gap-3 text-sm">
          {label}
          <Switch
            checked={f.state.value}
            onCheckedChange={f.handleChange}
            aria-label={label}
          />
        </label>
      )}
    </form.Field>
  )

  return (
    <FormSheet
      open={!!type}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Add discount type' : 'Edit discount type'}
      description="Changing a type never changes charges already discounted."
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
              htmlFor="dt-name"
              required
              error={fieldError(f)}
            >
              <Input
                id="dt-name"
                dir="auto"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="kind">
            {(f) => (
              <FieldWrapper label="Kind">
                <OptionSelect
                  options={[
                    { value: 'PERCENTAGE', label: 'Percentage' },
                    { value: 'FIXED', label: 'Fixed amount' },
                  ]}
                  value={f.state.value}
                  onChange={(v) =>
                    f.handleChange(v as DiscountTypeValues['kind'])
                  }
                />
              </FieldWrapper>
            )}
          </form.Field>
          {amount('value', 'Value', true)}
        </div>
        {amount('maxAmount', 'Max amount per use (Rs)')}
        <form.Field name="appliesTo">
          {(f) => (
            <FieldWrapper label="Applies to">
              <OptionSelect
                options={[
                  { value: 'ALL', label: 'Everything' },
                  { value: 'SERVICE_KINDS', label: 'Service kinds' },
                  { value: 'SERVICES', label: 'Specific services' },
                ]}
                value={f.state.value}
                onChange={(v) =>
                  f.handleChange(v as DiscountTypeValues['appliesTo'])
                }
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.appliesTo}>
          {(appliesTo) =>
            appliesTo === 'SERVICE_KINDS' ? (
              <form.Field name="serviceKinds">
                {(f) => (
                  <FieldWrapper label="Service kinds" error={fieldError(f)}>
                    <MultiSelect
                      aria-label="Service kinds"
                      placeholder="Pick service kinds"
                      options={KINDS.map((k) => ({
                        value: k,
                        label: k.charAt(0) + k.slice(1).toLowerCase(),
                      }))}
                      value={f.state.value}
                      onChange={(v) => f.handleChange(v as ServiceKind[])}
                      invalid={!!fieldError(f)}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            ) : appliesTo === 'SERVICES' ? (
              <form.Field name="serviceIds">
                {(f) => (
                  <FieldWrapper label="Services" error={fieldError(f)}>
                    <MultiSelect
                      aria-label="Services"
                      placeholder="Pick services"
                      searchPlaceholder="Search services"
                      options={(services.data ?? []).map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      value={f.state.value}
                      onChange={f.handleChange}
                      invalid={!!fieldError(f)}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>
        {flag('receptionEditable', 'Reception may change the value')}
        <form.Subscribe selector={(s) => s.values.receptionEditable}>
          {(editable) =>
            editable && (
              <div className="grid grid-cols-2 gap-4">
                {amount('minValue', 'Min value')}
                {amount('maxValue', 'Max value')}
              </div>
            )
          }
        </form.Subscribe>
        {flag('requiresNote', 'Note required when applied')}
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="validFrom">
            {(f) => (
              <FieldWrapper label="Valid from">
                <DatePicker
                  value={f.state.value || undefined}
                  onChange={f.handleChange}
                  clearable
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="validTo">
            {(f) => (
              <FieldWrapper label="Valid to" error={fieldError(f)}>
                <DatePicker
                  value={f.state.value || undefined}
                  onChange={f.handleChange}
                  clearable
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
      </div>
    </FormSheet>
  )
}
