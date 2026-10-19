import { Mail, MapPin, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PATIENT_DATA_LABEL } from '../types'
import type { LabLink } from '../types'
import { LabLinkActions } from './LabLinkActions'
import type { LinkActionHandlers } from './LabLinkActions'
import { LabStatusBadge, LabTypeBadge, LinkStatusBadge } from './lab-badges'

/** One lab on the clinic's list, card view. */
export function LabLinkCard({
  link,
  ...handlers
}: LinkActionHandlers & { link: LabLink }) {
  const { lab } = link
  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30',
        link.status === 'suspended' && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{lab.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <LinkStatusBadge status={link.status} />
            {lab.labType === 'internal' && <LabTypeBadge type={lab.labType} />}
            {lab.status === 'suspended' && (
              <LabStatusBadge status={lab.status} />
            )}
          </div>
        </div>
        <LabLinkActions link={link} {...handlers} />
      </div>

      <ul className="space-y-1 text-xs text-text-2">
        {lab.city && (
          <li className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-text-3" /> {lab.city}
          </li>
        )}
        {(lab.phone || lab.whatsappPhone) && (
          <li className="flex items-center gap-1.5">
            <Phone className="size-3.5 text-text-3" />
            {lab.phone ?? lab.whatsappPhone}
          </li>
        )}
        {lab.email && (
          <li className="flex items-center gap-1.5 truncate">
            <Mail className="size-3.5 text-text-3" /> {lab.email}
          </li>
        )}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
        <span className="tabular-nums">
          Pay in {link.paymentTermsDays} day
          {link.paymentTermsDays === 1 ? '' : 's'}
        </span>
        <span>{PATIENT_DATA_LABEL[link.patientDataLevel]}</span>
      </div>
    </article>
  )
}
