import { Building2, MapPin } from 'lucide-react'
import { StatusBadge } from '@/components/shared'
import { cn } from '@/lib/utils'
import { PORTAL_LINK_STATUS_LABEL } from '../types'
import type { LabLinkStatus, PortalClinic } from '../types'
import { PortalClinicActions } from './PortalClinicActions'
import type { ClinicActionHandlers } from './PortalClinicActions'

const TONE = {
  invited: 'warning',
  active: 'success',
  suspended: 'danger',
} as const

export function PortalLinkBadge({ status }: { status: LabLinkStatus }) {
  return (
    <StatusBadge
      status={status}
      tone={TONE[status]}
      label={PORTAL_LINK_STATUS_LABEL[status]}
    />
  )
}

/** One clinic the lab works with, card view. */
export function PortalClinicCard({
  link,
  ...handlers
}: ClinicActionHandlers & { link: PortalClinic }) {
  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30',
        link.status === 'suspended' && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              {link.clinic.name}
            </h2>
            <div className="mt-1">
              <PortalLinkBadge status={link.status} />
            </div>
          </div>
        </div>
        <PortalClinicActions link={link} {...handlers} />
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" /> {link.clinic.city ?? '—'}
        </span>
        <span className="tabular-nums">
          Pays in {link.paymentTermsDays} day
          {link.paymentTermsDays === 1 ? '' : 's'}
        </span>
      </div>
    </article>
  )
}
