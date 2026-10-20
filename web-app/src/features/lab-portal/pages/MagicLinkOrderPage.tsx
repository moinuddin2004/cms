import { FlaskConical, LinkIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import {
  OrderStatusBadge,
  orderError,
  toastOrderError,
} from '@/features/lab-orders'
import { LabOrderActions } from '../components/LabOrderActions'
import { fmtDateTime, LabOrderView } from '../components/LabOrderView'
import { useMagicLink, useMagicLinkAnswers } from '../hooks/usePortalOrders'
import { magicLinkApi } from '../services/lab-portal-orders.api'

const DEAD_LINK = new Set([
  'MAGIC_LINK_INVALID',
  'MAGIC_LINK_EXPIRED',
  'MAGIC_LINK_REVOKED',
])

/**
 * The no-login order page a lab opens from WhatsApp (lab ERD §7, §13):
 * one order, lab-safe fields, and the answers the link allows. A dead link
 * (expired, withdrawn, order closed) shows why and does nothing.
 */
export function MagicLinkOrderPage({ token }: { token: string }) {
  const { data, isLoading, isError, error, refetch } = useMagicLink(token)
  const answers = useMagicLinkAnswers(token)
  const failure = isError ? orderError(error) : null

  const download = async (attachmentId: string) => {
    try {
      const { url } = await magicLinkApi.attachmentUrl(token, attachmentId)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toastOrderError(err)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-2 p-4">
          <FlaskConical className="size-5 text-primary" />
          <span className="text-sm font-semibold">MedTrackr · Lab order</span>
          {data && (
            <span className="ml-auto text-xs text-text-3">
              For {data.link.lab.name} · link valid until{' '}
              {fmtDateTime(data.link.expiresAt)}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        {isLoading ? (
          <LoadingSkeleton variant="cards" />
        ) : failure?.code && DEAD_LINK.has(failure.code) ? (
          <EmptyState
            icon={LinkIcon}
            title={
              failure.code === 'MAGIC_LINK_INVALID'
                ? 'This link is not valid'
                : 'This link no longer works'
            }
            description={`${failure.message}. Ask the clinic to send a new link, or sign in to the lab portal.`}
          />
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Order {data.order.orderNo}
                </h1>
                <p className="text-sm text-text-3">
                  {data.order.clinic.name} · {data.order.patient.ref} · Doctor{' '}
                  {data.order.doctor?.fullName ?? '—'}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <OrderStatusBadge status={data.order.status} />
                  {data.order.priority === 'urgent' && (
                    <Badge variant="warning">Urgent</Badge>
                  )}
                  <span className="text-text-3">
                    Wanted by {data.order.requestedOn ?? '—'} · Ready on{' '}
                    {data.order.labExpectedOn ?? '—'}
                  </span>
                </div>
              </div>
              <LabOrderActions
                actions={data.actions}
                api={answers}
                version={data.order.version}
                labExpectedOn={data.order.labExpectedOn}
              />
            </div>
            <LabOrderView
              order={data.order}
              onDownload={(id) => void download(id)}
            />
          </>
        )}
      </main>
    </div>
  )
}
