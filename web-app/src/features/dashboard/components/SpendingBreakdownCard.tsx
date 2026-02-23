import { memo, useState } from 'react';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { SpendingData, ChartPeriod } from '@/features/dashboard/types';

interface SpendingBreakdownCardProps {
    data: SpendingData;
}

export const SpendingBreakdownCard = memo(function SpendingBreakdownCard({
    data,
}: SpendingBreakdownCardProps) {
    const [period, setPeriod] = useState<ChartPeriod>('6 month');

    const totalPercentage = data.categories.reduce(
        (sum, cat) => sum + cat.percentage,
        0,
    );

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold">Spending Overview</CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                            {period}
                            <ChevronDown size={12} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPeriod('6 month')}>
                            6 month
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPeriod('12 month')}>
                            12 month
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
                {/* Total Expense */}
                <div>
                    <p className="text-sm text-muted-foreground">Total Expense</p>
                    <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-3xl font-bold text-foreground">
                            ${data.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                            +{data.percentageChange}%
                            <TrendingUp size={14} />
                        </span>
                    </div>
                </div>

                {/* Segmented Progress Bar */}
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
                    {data.categories.map((cat) => (
                        <div
                            key={cat.name}
                            className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                            style={{
                                width: `${(cat.percentage / totalPercentage) * 100}%`,
                                backgroundColor: cat.color,
                            }}
                            title={`${cat.name}: $${cat.amount.toLocaleString()}`}
                        />
                    ))}
                </div>

                {/* Category Legend */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {data.categories.map((cat) => (
                        <div key={cat.name} className="flex items-center gap-2">
                            <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat.color }}
                            />
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{cat.name}</p>
                                <p className="text-sm font-semibold text-foreground">
                                    ${cat.amount.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
});
