import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/formatters'

export interface TopProcedure {
  name: string
  count: number
  revenue: number
}

interface Props {
  data: TopProcedure[]
}

export const TopProceduresCard = memo(function TopProceduresCard({
  data,
}: Props) {
  const max = Math.max(1, ...data.map((p) => p.revenue))
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Top Procedures by Revenue
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No billed procedures this month.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Procedure</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="max-w-[260px]">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(p.revenue / max) * 100}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(p.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
})
