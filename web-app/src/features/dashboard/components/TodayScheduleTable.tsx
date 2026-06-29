import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import type { Appointment } from '@/features/appointments/types'
import { AppointmentStatus } from '@/features/appointments/types'
import { InitialsAvatar } from '@/components/data-display/InitialsAvatar'

interface Props {
  data: Appointment[]
}

const STATUS_CHIP: Record<string, string> = {
  [AppointmentStatus.COMPLETED]: 'bg-emerald-soft text-emerald',
  [AppointmentStatus.IN_PROGRESS]: 'bg-primary-soft text-primary-text',
  [AppointmentStatus.CHECKED_IN]: 'bg-amber-soft text-amber',
  [AppointmentStatus.CONFIRMED]: 'bg-emerald-soft text-emerald',
  [AppointmentStatus.SCHEDULED]: 'bg-panel-2 text-text-2',
  [AppointmentStatus.NO_SHOW]: 'bg-danger-soft text-danger',
  [AppointmentStatus.CANCELLED]: 'bg-danger-soft text-danger',
  [AppointmentStatus.RESCHEDULED]: 'bg-violet-soft text-violet',
}

const STATUS_LABEL: Record<string, string> = {
  [AppointmentStatus.COMPLETED]: 'Completed',
  [AppointmentStatus.IN_PROGRESS]: 'In chair',
  [AppointmentStatus.CHECKED_IN]: 'Waiting',
  [AppointmentStatus.CONFIRMED]: 'Confirmed',
  [AppointmentStatus.SCHEDULED]: 'Scheduled',
  [AppointmentStatus.NO_SHOW]: 'No Show',
  [AppointmentStatus.CANCELLED]: 'Cancelled',
  [AppointmentStatus.RESCHEDULED]: 'Rescheduled',
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TodayScheduleTable({ data }: Props) {
  const columns = useMemo<ColumnDef<Appointment>[]>(
    () => [
      {
        id: 'patient',
        header: 'Patient',
        cell: ({ row }) => {
          const name = row.original.patient?.fullName ?? 'Unknown patient'
          return (
            <div className="flex items-center gap-2.5">
              <InitialsAvatar name={name} size="sm" />
              <span className="font-semibold">{name}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'startTime',
        header: 'Time',
        cell: ({ getValue }) => (
          <span className="text-text-2">{fmtTime(getValue<string>())}</span>
        ),
      },
      {
        id: 'doctor',
        header: 'Doctor',
        cell: ({ row }) => (
          <span className="text-text-2">
            {row.original.doctor?.fullName ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Procedure',
        cell: ({ getValue }) => (
          <span className="capitalize text-text-2">
            {getValue<string>()?.replace(/_/g, ' ') ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>()
          return (
            <span
              className={`inline-block rounded-[20px] px-[9px] py-[3px] text-[11px] font-semibold ${STATUS_CHIP[status] ?? 'bg-panel-2 text-text-2'}`}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
        <div className="text-[15px] font-bold">Today's Schedule</div>
        <Link
          to="/appointments"
          className="text-[13px] font-medium text-primary-text hover:underline"
        >
          View all
        </Link>
      </div>
      {data.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-text-3">
          No appointments scheduled for today.
        </p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-panel">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-text-3"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-border-soft transition-colors hover:bg-panel"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
