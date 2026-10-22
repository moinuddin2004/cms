import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Can } from '@/features/access'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { InitialsAvatar, StatusBadge } from '@/components/shared'
import {
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Droplets,
  Calendar,
} from 'lucide-react'
import type { Patient } from '../types'

interface PatientCardProps {
  patient: Patient
  onToggleStatus: (patient: Patient, isActive: boolean) => void
  onEdit: (patient: Patient) => void
  onDelete: (patient: Patient) => void
  isStatusPending?: boolean
}

function getAge(dob: string | null): string {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  return `${age}y`
}

function getDobDisplay(dob: string | null): string {
  if (!dob) return '—'
  return new Date(dob).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PatientCard({
  patient,
  onToggleStatus,
  onEdit,
  onDelete,
  isStatusPending,
}: PatientCardProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Card className="group relative overflow-hidden border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <InitialsAvatar
              name={patient.fullName}
              seed={patient.id}
              size="md"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to="/patients/$patientId"
                    params={{ patientId: patient.id }}
                    className="block truncate text-sm font-semibold text-foreground leading-tight transition-colors hover:text-primary"
                  >
                    {patient.fullName}
                  </Link>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {patient.patientNumber}
                    {patient.dob && (
                      <span className="text-muted-foreground/60">
                        {' '}
                        · {getAge(patient.dob)}
                      </span>
                    )}
                  </p>
                </div>
                <StatusBadge
                  status={patient.isActive ? 'active' : 'inactive'}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground mb-4">
            {patient.phone && (
              <div className="flex items-center gap-2.5">
                <Phone
                  size={12}
                  className="shrink-0 text-muted-foreground/50"
                />
                <span className="truncate">{patient.phone}</span>
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2.5">
                <Mail size={12} className="shrink-0 text-muted-foreground/50" />
                <span className="truncate">{patient.email}</span>
              </div>
            )}
            {patient.city && (
              <div className="flex items-center gap-2.5">
                <MapPin
                  size={12}
                  className="shrink-0 text-muted-foreground/50"
                />
                <span>{patient.city}</span>
              </div>
            )}
            {patient.dob && (
              <div className="flex items-center gap-2.5">
                <Calendar
                  size={12}
                  className="shrink-0 text-muted-foreground/50"
                />
                <span>{getDobDisplay(patient.dob)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <div>
              {patient.bloodGroup ? (
                <div className="flex items-center gap-1.5">
                  <Droplets size={11} className="text-rose-400" />
                  <Badge variant="muted" className="text-[10px] px-1.5 py-0">
                    {patient.bloodGroup}
                  </Badge>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground/30">—</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <TooltipButton
                tooltip="View patient"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                asChild
              >
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: patient.id }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Link>
              </TooltipButton>
              <Can perm="patients.edit">
                <TooltipButton
                  tooltip="Edit patient"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                  onClick={() => onEdit(patient)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </TooltipButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Switch
                        size="sm"
                        checked={patient.isActive}
                        disabled={isStatusPending}
                        onCheckedChange={(v) => onToggleStatus(patient, v)}
                        aria-label={
                          patient.isActive
                            ? 'Deactivate patient'
                            : 'Activate patient'
                        }
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {patient.isActive
                      ? 'Deactivate patient'
                      : 'Activate patient'}
                  </TooltipContent>
                </Tooltip>
              </Can>

              <Can perm="patients.delete">
                <TooltipButton
                  tooltip="Delete patient permanently"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(patient)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </TooltipButton>
              </Can>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
