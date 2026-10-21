import { useState } from 'react'
import {
  Check,
  Loader2,
  PackageCheck,
  PackageX,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Truck,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingSkeleton, StatusBadge } from '@/components/shared'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ReasonDialog } from '../ReasonDialog'
import { ItemStatusBadge } from '../order-badges'
import {
  useOrderProduction,
  useProductionMutation,
} from '../../hooks/useProduction'
import { productionApi } from '../../services/production.api'
import {
  REMAKE_REASON_LABEL,
  SHIPMENT_STATUS_LABEL,
  STAGE_STATUS_LABEL,
} from '../../production.types'
import type {
  ItemStage,
  ProductionItem,
  RemakeRequest,
  Shipment,
} from '../../production.types'
import type { LabOrderDetail } from '../../types'
import { ReceiveShipmentSheet } from './ReceiveShipmentForm'
import { RemakeDecisionSheet, RemakeRequestSheet } from './RemakeSheets'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted'
const STAGE_TONE: Record<string, Tone> = {
  pending: 'muted',
  at_lab: 'violet',
  sent_to_clinic: 'info',
  received: 'warning',
  tryin_done: 'warning',
  approved: 'success',
  correction: 'danger',
}

export function StageBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      status={status}
      tone={STAGE_TONE[status] ?? 'info'}
      label={STAGE_STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}
    />
  )
}

/** Stages of one item, each with its try-in rounds (round 1 is never overwritten). */
export function StageTimeline({ stages }: { stages: ItemStage[] }) {
  const bySeq = new Map<number, ItemStage[]>()
  for (const s of stages) bySeq.set(s.seq, [...(bySeq.get(s.seq) ?? []), s])
  return (
    <ol className="space-y-2" aria-label="Stages">
      {[...bySeq.entries()].map(([seq, rounds]) => (
        <li key={seq} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-40 shrink-0 font-medium">
            {seq}. {rounds[0].name}
          </span>
          {rounds.map((r) => (
            <span
              key={r.id}
              className={
                r.isActive
                  ? 'flex items-center gap-1 rounded-md ring-2 ring-primary/40'
                  : 'flex items-center gap-1'
              }
              title={r.correctionNotes ?? r.tryinNotes ?? undefined}
            >
              {rounds.length > 1 && (
                <span className="text-xs text-text-3">R{r.roundNo}</span>
              )}
              <StageBadge status={r.status} />
            </span>
          ))}
        </li>
      ))}
    </ol>
  )
}

/**
 * Production on a lab order (lab ERD §14 steps 6–8): incoming shipments to
 * receive, every item's stages and try-in rounds with the doctor's
 * actions, delivery + warranty, and remake requests.
 */
export function ProductionPanel({ order }: { order: LabOrderDetail }) {
  const orderId = order.id
  const { data, isLoading, isError, refetch } = useOrderProduction(orderId)
  const [receiving, setReceiving] = useState<Shipment | null>(null)
  const [losing, setLosing] = useState<Shipment | null>(null)
  const [correcting, setCorrecting] = useState<ItemStage | null>(null)
  const [rejecting, setRejecting] = useState<ProductionItem | null>(null)
  const [aftercare, setAftercare] = useState<ProductionItem | null>(null)
  const [deciding, setDeciding] = useState<RemakeRequest | null>(null)

  const tryin = useProductionMutation(
    (s: ItemStage) => productionApi.tryin(orderId, s.id, {}),
    'Try-in recorded',
  )
  const decide = useProductionMutation(
    (v: {
      stage: ItemStage
      decision: 'approve' | 'correction'
      notes?: string
    }) =>
      productionApi.decide(orderId, v.stage.id, {
        decision: v.decision,
        notes: v.notes,
      }),
  )
  const approve = useProductionMutation(
    (i: ProductionItem) => productionApi.approve(orderId, i.id),
    'Work approved',
  )
  const deliver = useProductionMutation(
    (i: ProductionItem) => productionApi.deliver(orderId, i.id),
    'Delivered — warranty started',
  )
  const receive = useProductionMutation(
    (v: {
      shipment: Shipment
      lines: Parameters<typeof productionApi.receive>[1]['lines']
    }) => productionApi.receive(v.shipment.id, { lines: v.lines }),
    'Shipment received',
  )
  const lost = useProductionMutation(
    (v: { shipment: Shipment; reason: string }) =>
      productionApi.markLost(v.shipment.id, v.reason),
    'Shipment marked lost — the lab will ship again',
  )
  const reject = useProductionMutation(
    (v: {
      item: ProductionItem
      reasonCode: RemakeRequest['reasonCode']
      notes: string
    }) =>
      productionApi.reject(orderId, v.item.id, {
        reasonCode: v.reasonCode,
        reason: v.notes,
      }),
    'Work rejected — remake requested',
  )
  const requestRemake = useProductionMutation(
    (v: {
      item: ProductionItem
      reasonCode: RemakeRequest['reasonCode']
      notes: string
    }) =>
      productionApi.requestRemake(orderId, v.item.id, {
        reasonCode: v.reasonCode,
        notes: v.notes,
      }),
    'Remake requested',
  )
  const decideRemake = useProductionMutation(
    (v: {
      remake: RemakeRequest
      decision: 'agree' | 'close'
      responsibleParty: RemakeRequest['responsibleParty']
      note: string
    }) =>
      productionApi.decideRemake(orderId, v.remake.id, {
        decision: v.decision,
        version: v.remake.version,
        responsibleParty: v.responsibleParty,
        note: v.note || undefined,
      }),
    'Remake decision saved',
  )

  if (isLoading) return <LoadingSkeleton variant="cards" />
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />

  const incoming = data.shipments.filter(
    (s) =>
      s.direction === 'to_clinic' &&
      (s.status === 'dispatched' || s.status === 'partially_received'),
  )
  const pricesOf = (itemId: string) => {
    const p = order.items.find((i) => i.id === itemId)?.prices
    return p
      ? { lab: p.labLineCostPaisa, patient: p.patientLinePricePaisa }
      : null
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-medium">Production</h2>

      {incoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Incoming from the lab</h3>
          {incoming.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/30"
            >
              <span className="flex items-center gap-2">
                <Truck className="size-4 text-blue-600" />
                {s.shipmentNo} · {s.lines.filter((l) => !l.condition).length}{' '}
                open line(s) · {SHIPMENT_STATUS_LABEL[s.status]}
                {s.courierName && ` · ${s.courierName}`}
                {s.trackingNo && ` #${s.trackingNo}`}
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => setReceiving(s)}>
                  <PackageCheck className="size-4" /> Receive
                </Button>
                <TooltipButton
                  tooltip="Mark this shipment lost"
                  size="icon"
                  variant="outline"
                  onClick={() => setLosing(s)}
                >
                  <PackageX className="size-4" />
                </TooltipButton>
              </span>
            </div>
          ))}
        </div>
      )}

      {data.items.map((item) => {
        const active = item.stages.find((s) => s.isActive) ?? null
        const tryinStage = active && !active.isFinal ? active : null
        const finalStage = active?.isFinal ? active : null
        const finalReceived =
          item.status === 'received' &&
          (!finalStage ||
            finalStage.status === 'tryin_done' ||
            !finalStage.requiresPatientVisit)
        return (
          <div
            key={item.id}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {item.lineNo}. {item.serviceName}
                  {item.remakeOfItemId && (
                    <Badge variant="warning" className="ml-2">
                      Remake
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-text-3">
                  Technician: {item.assignee?.name ?? 'not assigned yet'}
                </p>
              </div>
              <ItemStatusBadge status={item.status} />
            </div>

            {item.stages.length > 0 && <StageTimeline stages={item.stages} />}

            {item.warranty && (
              <p className="flex items-center gap-2 text-xs text-text-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                Warranty {item.warranty.startsOn} → {item.warranty.endsOn}
                {item.warranty.voidedAt ? ' (void)' : ''}
                {item.warranty.terms ? ` · ${item.warranty.terms}` : ''}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {(tryinStage?.status === 'received' ||
                finalStage?.status === 'received') &&
                (tryinStage ?? finalStage)!.requiresPatientVisit && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={tryin.isPending}
                    onClick={() => tryin.mutate((tryinStage ?? finalStage)!)}
                  >
                    {tryin.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Stethoscope className="size-4" />
                    )}
                    Record try-in
                  </Button>
                )}
              {tryinStage &&
                (tryinStage.status === 'tryin_done' ||
                  (tryinStage.status === 'received' &&
                    !tryinStage.requiresPatientVisit)) && (
                  <>
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          stage: tryinStage,
                          decision: 'approve',
                        })
                      }
                    >
                      {decide.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Approve {tryinStage.name}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCorrecting(tryinStage)}
                    >
                      <Wrench className="size-4" /> Needs correction
                    </Button>
                  </>
                )}
              {finalReceived && (
                <>
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(item)}
                  >
                    {approve.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Approve work
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejecting(item)}
                  >
                    <RotateCcw className="size-4" /> Reject — remake
                  </Button>
                </>
              )}
              {item.status === 'approved' && (
                <Button
                  size="sm"
                  disabled={deliver.isPending}
                  onClick={() => deliver.mutate(item)}
                >
                  {deliver.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Fitted — mark delivered
                </Button>
              )}
              {item.status === 'delivered' &&
                !data.remakeRequests.some(
                  (r) =>
                    r.originalItemId === item.id &&
                    (r.status === 'requested' || r.status === 'disputed'),
                ) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAftercare(item)}
                  >
                    <RotateCcw className="size-4" /> Request remake
                  </Button>
                )}
            </div>
          </div>
        )
      })}

      {data.remakeRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Remake requests</h3>
          {data.remakeRequests.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <span>
                Line {r.originalLineNo} · {REMAKE_REASON_LABEL[r.reasonCode]}
                {r.isWarrantyClaim && (
                  <Badge variant="success" className="ml-2">
                    Warranty claim
                  </Badge>
                )}
                {r.newLineNo && ` → new line ${r.newLineNo}`}
                {r.notes && (
                  <span className="block text-xs text-text-3">{r.notes}</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {(r.status === 'requested' || r.status === 'disputed') && (
                  <Button size="sm" onClick={() => setDeciding(r)}>
                    Decide
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <ReceiveShipmentSheet
        shipment={receiving}
        onOpenChange={(o) => !o && setReceiving(null)}
        onSubmit={(lines) =>
          receive.mutateAsync({ shipment: receiving!, lines })
        }
      />
      <ReasonDialog
        open={!!losing}
        onOpenChange={(o) => !o && setLosing(null)}
        title={`Mark ${losing?.shipmentNo ?? ''} lost`}
        description="Lines not received yet become missing. The work stays owed — the lab ships it again."
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
      <ReasonDialog
        open={!!correcting}
        onOpenChange={(o) => !o && setCorrecting(null)}
        title={`Correction — ${correcting?.name ?? ''}`}
        description="The lab gets this round back with your notes; the stage starts again as the next round."
        confirmLabel="Send correction"
        isLoading={decide.isPending}
        onConfirm={(notes) =>
          decide.mutate(
            { stage: correcting!, decision: 'correction', notes },
            { onSuccess: () => setCorrecting(null) },
          )
        }
      />
      <RemakeRequestSheet
        item={rejecting}
        mode="reject"
        onOpenChange={(o) => !o && setRejecting(null)}
        onSubmit={(v) => reject.mutateAsync({ item: rejecting!, ...v })}
      />
      <RemakeRequestSheet
        item={aftercare}
        mode="aftercare"
        onOpenChange={(o) => !o && setAftercare(null)}
        onSubmit={(v) => requestRemake.mutateAsync({ item: aftercare!, ...v })}
      />
      <RemakeDecisionSheet
        remake={deciding}
        item={data.items.find((i) => i.id === deciding?.originalItemId)}
        prices={deciding ? pricesOf(deciding.originalItemId) : null}
        onOpenChange={(o) => !o && setDeciding(null)}
        onSubmit={(v) => decideRemake.mutateAsync({ remake: deciding!, ...v })}
      />
    </section>
  )
}
