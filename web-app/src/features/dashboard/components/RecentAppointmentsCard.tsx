import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/formatters'
import { formatInClinic, formatTime } from '@/lib/datetime'
import {
  
  AppointmentStatus,
  STATUS_BG_COLORS
} from '@/features/appointments/types'
import type {Appointment} from '@/features/appointments/types';

interface Props {
  data: Appointment[]
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.CONFIRMED]: 'Confirmed',
  [AppointmentStatus.CHECKED_IN]: 'Checked in',
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
}

function fmtTime(iso: string): string {
  return formatTime(iso)
}

function fmtDay(iso: string): string {
  return formatInClinic(iso, 'EEE, MMM d')
}

export const RecentAppointmentsCard = memo(function RecentAppointmentsCard({
  data,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Today&apos;s Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No appointments scheduled for today.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => {
                const name = a.patient?.fullName ?? 'Unknown patient'
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          {a.patient?.patientNumber && (
                            <p className="text-xs text-muted-foreground">
                              {a.patient.patientNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-foreground">{fmtTime(a.startTime)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDay(a.startTime)}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.doctor?.fullName ?? '—'}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {a.type?.replace(/_/g, ' ') ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-medium text-xs',
                          STATUS_BG_COLORS[a.status],
                        )}
                      >
                        {STATUS_LABELS[a.status] ?? a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
})
