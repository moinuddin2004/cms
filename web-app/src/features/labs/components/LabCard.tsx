import { Building2, MapPin, Pencil, Phone, Users } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import type { Lab } from '../types'
import { LabStatusBadge, LabTypeBadge } from './lab-badges'
import { LabStatusSwitch } from './LabStatusSwitch'

/** A lab in the platform directory, card view. */
export function LabCard({
  lab,
  onOpen,
  onEdit,
}: {
  lab: Lab
  onOpen: (lab: Lab) => void
  onEdit: (lab: Lab) => void
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lab)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(lab)}
      className={cn(
        'flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30',
        lab.status === 'suspended' && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{lab.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <LabStatusBadge status={lab.status} />
            <LabTypeBadge type={lab.labType} />
          </div>
        </div>
        <TooltipButton
          tooltip={`Edit ${lab.name}`}
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(lab)
          }}
        >
          <Pencil className="size-4" />
        </TooltipButton>
      </div>

      <ul className="space-y-1 text-xs text-text-2">
        {lab.ownerOrganization && (
          <li className="flex items-center gap-1.5 truncate">
            <Building2 className="size-3.5 text-text-3" />
            {lab.ownerOrganization.name}
          </li>
        )}
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
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
        <span className="flex items-center gap-3 tabular-nums">
          <span className="flex items-center gap-1">
            <Building2 className="size-3.5" /> {lab.activeLinkCount} clinic
            {lab.activeLinkCount === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" /> {lab.memberCount} staff
          </span>
        </span>
        <LabStatusSwitch lab={lab} />
      </div>
    </article>
  )
}
