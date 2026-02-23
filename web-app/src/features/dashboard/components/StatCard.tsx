import { memo } from 'react';
import {
    Users,
    CalendarCheck,
    DollarSign,
    Smile,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TrendDirection } from '@/features/dashboard/types';

interface StatCardProps {
    title: string;
    value: string;
    subLabel: string;
    percentageChange: number;
    trend: TrendDirection;
    icon: string;
}

const iconMap: Record<string, React.ElementType> = {
    users: Users,
    'calendar-check': CalendarCheck,
    'dollar-sign': DollarSign,
    smile: Smile,
};

const iconBgMap: Record<string, string> = {
    users: 'bg-blue-50 text-blue-600',
    'calendar-check': 'bg-purple-50 text-purple-600',
    'dollar-sign': 'bg-green-50 text-green-600',
    smile: 'bg-amber-50 text-amber-600',
};

export const StatCard = memo(function StatCard({
    title,
    value,
    subLabel,
    percentageChange,
    trend,
    icon,
}: StatCardProps) {
    const IconComponent = iconMap[icon] || Users;
    const iconClasses = iconBgMap[icon] || 'bg-gray-50 text-gray-600';

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
                <div className="flex items-start gap-3">
                    <div className={cn('p-2.5 rounded-lg', iconClasses)}>
                        <IconComponent size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground font-medium">{title}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-muted-foreground">{subLabel}</span>
                            <span
                                className={cn(
                                    'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded',
                                    trend === 'up'
                                        ? 'text-green-700 bg-green-50'
                                        : 'text-red-700 bg-red-50',
                                )}
                            >
                                {percentageChange}%
                                {trend === 'up' ? (
                                    <TrendingUp size={12} />
                                ) : (
                                    <TrendingDown size={12} />
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});
