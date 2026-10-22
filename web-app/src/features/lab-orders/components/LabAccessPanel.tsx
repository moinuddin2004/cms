import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Copy, Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useAccess } from '@/features/access'
import { LabOrderActions } from '@/features/lab-portal'
import type { LabActionsApi } from '@/features/lab-portal'
import { useOrderMutation } from '../hooks/useLabOrders'
import { toastOrderError } from '../lib/order-errors'
import { labOrderKeys } from '../query-keys'
import { labOrdersApi } from '../services/lab-orders.api'
import type { LabOrderDetail, OrderMagicLink } from '../types'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

const STATE_BADGE: Record<
  OrderMagicLink['state'],
  { label: string; variant: 'success' | 'muted' | 'danger' }
> = {
  active: { label: 'Active', variant: 'success' },
  expired: { label: 'Expired', variant: 'muted' },
  used_up: { label: 'Used up', variant: 'muted' },
  revoked: { label: 'Revoked', variant: 'danger' },
}

const DELIVERY_LABEL: Record<string, string> = {
  queued: 'sending',
  held_quiet_hours: 'held (quiet hours)',
  sent: 'sent',
  delivered: 'delivered',
  failed: 'failed',
  skipped_disabled: 'off in notification settings',
  skipped_opt_out: 'opted out',
}

const describeDelivery = (l: OrderMagicLink) =>
  l.delivery === 'copy'
    ? 'Copied by clinic staff'
    : l.deliveries
        .map(
          (d) =>
            `${d.channel === 'whatsapp' ? 'WhatsApp' : d.channel}: ${DELIVERY_LABEL[d.status] ?? d.status}`,
        )
        .join(' · ') || 'Not sent'

/**
 * How the lab gets to this order without the portal (lab ERD §7, §14 step
 * 5): WhatsApp magic links (send, copy, revoke — `lab.orders.create`) and,
 * for lab coordinators (`lab.orders.create` + `lab.links.manage`) when the
 * lab doesn't answer, proxy updates recorded as `via = proxy`.
 */
export function LabAccessPanel({ order }: { order: LabOrderDetail }) {
  const queryClient = useQueryClient()
  const { can, canAll } = useAccess()
  const canSend = can('lab.orders.create')
  const canProxy = canAll(['lab.orders.create', 'lab.links.manage'])
  const links = useQuery({
    queryKey: labOrderKeys.magicLinks(order.id),
    queryFn: () => labOrdersApi.magicLinks(order.id),
  })
  const proxy = useQuery({
    queryKey: labOrderKeys.proxyActions(order.id),
    queryFn: () => labOrdersApi.proxyActions(order.id),
    enabled: canProxy,
    retry: false,
  })
  const [revoking, setRevoking] = useState<OrderMagicLink | null>(null)

  const send = useOrderMutation(
    () => labOrdersApi.issueMagicLink(order.id, { delivery: 'notification' }),
    { success: `Link sent to ${order.lab.name}` },
  )
  const copy = useOrderMutation(
    () => labOrdersApi.issueMagicLink(order.id, { delivery: 'copy' }),
    {},
  )
  const revoke = useOrderMutation(
    (l: OrderMagicLink) => labOrdersApi.revokeMagicLink(order.id, l.id),
    { success: 'Link revoked — it no longer opens the order' },
  )

  const copyLink = () =>
    copy.mutate(undefined, {
      onSuccess: async ({ url }) => {
        if (!url) return
        try {
          await navigator.clipboard.writeText(url)
          toast.success('Link copied — paste it into WhatsApp')
        } catch {
          toast.message('Copy this link', { description: url })
        }
      },
    })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: labOrderKeys.all })
  function asProxy<T>(fn: (body: T) => Promise<unknown>, success: string) {
    return async (body: T) => {
      try {
        await fn(body)
        toast.success(success)
      } catch (err) {
        toastOrderError(err)
        throw err
      } finally {
        await refresh()
      }
    }
  }
  const proxyApi: LabActionsApi = {
    accept: asProxy(
      (b: Parameters<LabActionsApi['accept']>[0]) =>
        labOrdersApi.proxy.accept(order.id, b),
      'Accepted on behalf of the lab',
    ),
    reject: asProxy(
      (b: Parameters<LabActionsApi['reject']>[0]) =>
        labOrdersApi.proxy.reject(order.id, b),
      'Rejected on behalf of the lab',
    ),
    clarify: asProxy(
      (b: Parameters<LabActionsApi['clarify']>[0]) =>
        labOrdersApi.proxy.clarify(order.id, b),
      'Lab’s question recorded',
    ),
    changeExpectedDate: asProxy(
      (b: Parameters<NonNullable<LabActionsApi['changeExpectedDate']>>[0]) =>
        labOrdersApi.proxy.changeExpectedDate(order.id, b),
      'Expected date changed',
    ),
  }

  const open = !['draft', 'cancelled', 'completed', 'rejected_by_lab'].includes(
    order.status,
  )

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Lab access</h2>
        {open && canSend && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={send.isPending}
              onClick={() => send.mutate(undefined)}
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Send link to lab
            </Button>
            <Button
              variant="outline"
              disabled={copy.isPending}
              onClick={copyLink}
            >
              {copy.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy link
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-text-3">
        A link lets the lab open this order and accept, reject or ask a question
        without logging in. It expires after a day and stops working when the
        order closes.
      </p>

      {links.isLoading ? (
        <p className="text-sm text-text-3">Loading links…</p>
      ) : links.isError ? (
        <p className="text-sm text-danger">Couldn’t load the links.</p>
      ) : !links.data?.length ? (
        <p className="text-sm text-text-3">No links sent yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {links.data.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant={STATE_BADGE[l.state].variant}>
                    {STATE_BADGE[l.state].label}
                  </Badge>
                  <span className="text-text-2">
                    {fmt(l.createdAt)} · until {fmt(l.expiresAt)}
                  </span>
                </div>
                <p className="text-xs text-text-3">
                  {describeDelivery(l)}
                  {l.lastViewedAt ? ` · opened ${fmt(l.lastViewedAt)}` : ''}
                  {l.usedCount ? ` · used ${l.usedCount}×` : ''}
                </p>
              </div>
              {canSend && l.state === 'active' && (
                <TooltipButton
                  tooltip="Revoke link"
                  size="icon"
                  variant="ghost"
                  onClick={() => setRevoking(l)}
                >
                  <Ban className="size-4" />
                </TooltipButton>
              )}
            </li>
          ))}
        </ul>
      )}

      {canProxy && proxy.data && proxy.data.actions.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-medium">Update for the lab</p>
          <p className="text-xs text-text-3">
            Lab not answering? Record its answer here. The history shows it was
            entered by the clinic on the lab’s behalf.
          </p>
          <LabOrderActions
            actions={proxy.data.actions}
            api={proxyApi}
            version={order.version}
            labExpectedOn={order.labExpectedOn}
            size="sm"
          />
        </div>
      )}

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke this link?"
        description="The lab won’t be able to open the order with it any more. You can send a new one."
        confirmLabel="Revoke link"
        destructive
        isLoading={revoke.isPending}
        onConfirm={() =>
          revoke.mutate(revoking!, { onSuccess: () => setRevoking(null) })
        }
      />
    </section>
  )
}
