import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Ban, Pencil, Plus, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormSection,
  LoadingSkeleton,
} from '@/components/shared'
import {
  useServicePrices,
  useSetOptionActive,
  useVoidPrice,
} from '../hooks/usePlatformCatalog'
import { catalogToday, formatMinor, formatYmd } from '../lib/money'
import { OPTION_TYPE_LABEL } from '../types'
import type { LabServiceItem, PriceWindow, ServiceOption } from '../types'
import { ActiveSwitch } from './ActiveSwitch'
import { ServiceOptionSheet } from './ServiceOptionSheet'
import { ServicePriceSheet } from './ServicePriceSheet'
import { VoidPriceDialog } from './VoidPriceDialog'

type PriceState = 'running' | 'scheduled' | 'ended' | 'voided'

function stateOf(p: PriceWindow, today: string): PriceState {
  if (p.voidedAt) return 'voided'
  if (p.effectiveFrom > today) return 'scheduled'
  if (p.effectiveTo && p.effectiveTo < today) return 'ended'
  return 'running'
}

const STATE_BADGE: Record<
  PriceState,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  running: { label: 'In use', variant: 'default' },
  scheduled: { label: 'Scheduled', variant: 'outline' },
  ended: { label: 'Ended', variant: 'secondary' },
  voided: { label: 'Voided', variant: 'secondary' },
}

/** One service's options and price windows (list + per-clinic rates). */
export function ServicePricingSheet({
  labId,
  service,
  onOpenChange,
}: {
  labId: string
  service: LabServiceItem | null
  onOpenChange: (open: boolean) => void
}) {
  const serviceId = service?.id ?? ''
  const prices = useServicePrices(labId, service?.id ?? null)
  const setOptionActive = useSetOptionActive(labId, serviceId)
  const voidPrice = useVoidPrice(labId, serviceId)
  const [optionSheet, setOptionSheet] = useState<{
    option: ServiceOption | null
  } | null>(null)
  const [priceSheet, setPriceSheet] = useState<{
    price: PriceWindow | null
  } | null>(null)
  const [voiding, setVoiding] = useState<PriceWindow | null>(null)
  const today = catalogToday()
  const pendingOption = setOptionActive.isPending
    ? setOptionActive.variables.option.id
    : null

  const optionColumns = useMemo<ColumnDef<ServiceOption, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Option',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.name}</p>
            <p className="truncate text-xs text-text-3">
              {OPTION_TYPE_LABEL[row.original.optionType]} · {row.original.code}
            </p>
          </div>
        ),
      },
      {
        id: 'cost',
        header: 'Extra / unit',
        accessorKey: 'extraCostMinor',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            +{formatMinor(row.original.extraCostMinor)}
          </span>
        ),
      },
      {
        id: 'active',
        header: 'Offered',
        enableSorting: false,
        cell: ({ row }) => (
          <ActiveSwitch
            checked={row.original.isActive}
            disabled={pendingOption === row.original.id}
            label={`${row.original.name} is offered`}
            onTooltip="Offered — click to stop offering"
            offTooltip="Not offered — click to offer again"
            onChange={(isActive) =>
              setOptionActive.mutate({ option: row.original, isActive })
            }
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TooltipButton
              tooltip={`Edit ${row.original.name}`}
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setOptionSheet({ option: row.original })}
            >
              <Pencil className="size-4" />
            </TooltipButton>
          </div>
        ),
      },
    ],
    [pendingOption],
  )

  const priceColumns = useMemo<ColumnDef<PriceWindow, unknown>[]>(
    () => [
      {
        id: 'who',
        header: 'Applies to',
        accessorFn: (p) => p.organization?.name ?? '',
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {row.original.organization?.name ?? 'List price'}
          </span>
        ),
      },
      {
        id: 'amount',
        header: 'Price / unit',
        accessorKey: 'unitPriceMinor',
        cell: ({ row }) => (
          <div className="text-sm tabular-nums">
            <p>
              {formatMinor(row.original.unitPriceMinor, row.original.currency)}
            </p>
            {row.original.rushSurchargeMinor > 0 && (
              <p className="text-xs text-text-3">
                Rush +{formatMinor(row.original.rushSurchargeMinor)}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'window',
        header: 'Dates',
        accessorKey: 'effectiveFrom',
        cell: ({ row }) => (
          <span className="text-sm text-text-2">
            {formatYmd(row.original.effectiveFrom)} –{' '}
            {row.original.effectiveTo
              ? formatYmd(row.original.effectiveTo)
              : 'onwards'}
          </span>
        ),
      },
      {
        id: 'state',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const s = STATE_BADGE[stateOf(row.original, today)]
          return (
            <Badge variant={s.variant} className="font-normal">
              {s.label}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const state = stateOf(row.original, today)
          if (state === 'voided' || state === 'ended') return null
          return (
            <div className="flex justify-end gap-1">
              <TooltipButton
                tooltip={
                  state === 'running' ? 'Set an end date' : 'Edit this price'
                }
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setPriceSheet({ price: row.original })}
              >
                <Pencil className="size-4" />
              </TooltipButton>
              {state === 'scheduled' && (
                <TooltipButton
                  tooltip="Void — it never takes effect"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => setVoiding(row.original)}
                >
                  <Ban className="size-4" />
                </TooltipButton>
              )}
            </div>
          )
        },
      },
    ],
    [today],
  )

  return (
    <Sheet open={!!service} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b border-border-soft px-6 py-5">
          <SheetTitle className="text-[17px] font-bold">
            {service?.name} — options & prices
          </SheetTitle>
          <SheetDescription className="text-[13px] text-text-3">
            Prices are in force for the dates shown. A clinic's own rate wins
            over the list price; orders keep the price they were placed at.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
          <FormSection title="Prices">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setPriceSheet({ price: null })}>
                <Plus className="size-3.5" /> Add price
              </Button>
            </div>
            {prices.isLoading ? (
              <LoadingSkeleton variant="table" rows={3} />
            ) : prices.isError ? (
              <ErrorState onRetry={() => void prices.refetch()} />
            ) : !prices.data?.length ? (
              <EmptyState
                icon={Tag}
                title="No prices yet"
                description="Clinics can't order this service until it has a price."
              />
            ) : (
              <DataTable
                columns={priceColumns}
                data={prices.data}
                pagination={false}
                getRowClassName={(p) =>
                  p.voidedAt ? 'opacity-60 line-through' : undefined
                }
              />
            )}
          </FormSection>

          <FormSection title="Options">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOptionSheet({ option: null })}
              >
                <Plus className="size-3.5" /> Add option
              </Button>
            </div>
            {service && service.options.length ? (
              <DataTable
                columns={optionColumns}
                data={service.options}
                pagination={false}
              />
            ) : (
              <p className="text-sm text-text-3">
                No materials or variants. Add one when the lab charges extra for
                it (e.g. layered porcelain).
              </p>
            )}
          </FormSection>
        </div>

        {service && (
          <>
            <ServiceOptionSheet
              open={!!optionSheet}
              onOpenChange={(o) => !o && setOptionSheet(null)}
              labId={labId}
              serviceId={service.id}
              option={optionSheet?.option ?? null}
            />
            <ServicePriceSheet
              open={!!priceSheet}
              onOpenChange={(o) => !o && setPriceSheet(null)}
              labId={labId}
              serviceId={service.id}
              serviceName={service.name}
              price={priceSheet?.price ?? null}
            />
            <VoidPriceDialog
              price={voiding}
              onOpenChange={(o) => !o && setVoiding(null)}
              onConfirm={(reason) =>
                voidPrice.mutateAsync({ price: voiding!, reason })
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
