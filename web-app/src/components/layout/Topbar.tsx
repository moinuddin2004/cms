import { Download, Upload, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStore } from '@/store/ui-store';
import { LocationSwitcher } from '@/components/layout/LocationSwitcher';

interface TopbarProps {
    title: string;
}

const dateFilterOptions = [
    'Last 7 days',
    'Last 30 days',
    'Last 3 months',
    'Last 6 months',
    'Last 12 months',
    'Custom Range',
];

export function Topbar({ title }: TopbarProps) {
    const { dateFilter, setDateFilter } = useUIStore();

    return (
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-foreground">{title}</h1>
                <LocationSwitcher />
            </div>

            <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2">
                    <Download size={16} />
                    Export
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                    <Upload size={16} />
                    Import
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            {dateFilter}
                            <ChevronDown size={14} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {dateFilterOptions.map((option) => (
                            <DropdownMenuItem
                                key={option}
                                onClick={() => setDateFilter(option)}
                                className={option === dateFilter ? 'bg-accent' : ''}
                            >
                                {option}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
