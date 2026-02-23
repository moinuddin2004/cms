import { useMemo, memo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import { cn } from '@/lib/utils';
import type { Appointment, AppointmentStatus } from '@/features/dashboard/types';

interface AppointmentsTableProps {
    data: Appointment[];
}

const statusStyles: Record<AppointmentStatus, string> = {
    Completed: 'bg-green-50 text-green-700 border-green-200',
    'No Show': 'bg-red-50 text-red-700 border-red-200',
    Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    Cancelled: 'bg-gray-50 text-gray-700 border-gray-200',
};

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export const AppointmentsTable = memo(function AppointmentsTable({
    data,
}: AppointmentsTableProps) {
    const columns = useMemo<ColumnDef<Appointment, unknown>[]>(
        () => [
            {
                accessorKey: 'patientName',
                header: 'Patients',
                cell: ({ row }) => (
                    <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-brand-50 text-brand-700 text-xs font-semibold">
                                {getInitials(row.original.patientName)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium text-foreground">{row.original.patientName}</p>
                            <p className="text-xs text-muted-foreground">{row.original.patientAge} years</p>
                        </div>
                    </div>
                ),
            },
            {
                accessorKey: 'date',
                header: 'Date',
                cell: ({ row }) => (
                    <span className="text-muted-foreground">{row.original.date}</span>
                ),
            },
            {
                accessorKey: 'timeSlot',
                header: 'Duration',
                cell: ({ row }) => (
                    <div>
                        <p className="text-foreground">{row.original.timeSlot}</p>
                        <p className="text-xs text-muted-foreground">{row.original.duration}</p>
                    </div>
                ),
            },
            {
                accessorKey: 'contactPhone',
                header: 'Contact',
                cell: ({ row }) => (
                    <div>
                        <p className="text-foreground">{row.original.contactPhone}</p>
                        <p className="text-xs text-muted-foreground">{row.original.contactEmail}</p>
                    </div>
                ),
            },
            {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => {
                    const status = row.original.status;
                    return (
                        <Badge
                            variant="outline"
                            className={cn(
                                'font-medium text-xs px-2.5 py-0.5',
                                statusStyles[status],
                            )}
                        >
                            <span
                                className={cn(
                                    'w-1.5 h-1.5 rounded-full mr-1.5',
                                    status === 'Completed' && 'bg-green-500',
                                    status === 'No Show' && 'bg-red-500',
                                    status === 'Scheduled' && 'bg-blue-500',
                                    status === 'Cancelled' && 'bg-gray-500',
                                )}
                            />
                            {status}
                        </Badge>
                    );
                },
            },
            {
                accessorKey: 'doctorAssigned',
                header: 'Doctor Assigned',
                cell: ({ row }) => (
                    <span className="text-foreground">{row.original.doctorAssigned}</span>
                ),
            },
            {
                accessorKey: 'details',
                header: 'Details',
                cell: ({ row }) => (
                    <span className="text-foreground">{row.original.details}</span>
                ),
            },
            {
                id: 'actions',
                header: '',
                cell: () => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Reschedule</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Cancel</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
        ],
        [],
    );

    return (
        <DataTable<Appointment>
            columns={columns}
            data={data}
            searchKey="patientName"
            searchPlaceholder="Search.."
            title="All Appointments"
        />
    );
});
