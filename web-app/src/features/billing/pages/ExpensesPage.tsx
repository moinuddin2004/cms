import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Trash2, Wallet } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  useExpenses,
  useExpenseSummary,
  useDeleteExpense,
} from '@/features/billing/hooks/useExpenses'
import { Can } from '@/features/access'
import { ExpenseFormDialog } from '@/features/billing/components/ExpenseFormDialog'
import { ExpenseCategory } from '@/features/billing/types'

const CATEGORY_TABS: Array<{ label: string; value?: ExpenseCategory }> = [
  { label: 'All' },
  ...Object.values(ExpenseCategory).map((c) => ({
    label: c.charAt(0) + c.slice(1).toLowerCase(),
    value: c,
  })),
]

export function ExpensesPage() {
  const now = new Date()
  const [category, setCategory] = useState<ExpenseCategory | undefined>()
  const { data: page, isLoading } = useExpenses({ category, limit: 30 })
  const { data: summary } = useExpenseSummary(
    now.getMonth() + 1,
    now.getFullYear(),
  )
  const del = useDeleteExpense()

  return (
    <PageWrapper
      title="Expenses"
      subtitle="Track and categorise clinic spending"
      actions={
        <Can perm="expenses.manage">
          <ExpenseFormDialog />
        </Can>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-2">This Month Total</p>
                  <h3 className="mt-1 text-2xl font-bold">
                    {formatCurrency(summary?.grandTotal ?? 0)}
                  </h3>
                </div>
                <div className="rounded-lg bg-primary-soft p-2 text-primary-text">
                  <Wallet className="size-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          {(summary?.byCategory ?? []).slice(0, 3).map((c) => (
            <Card key={c.category}>
              <CardContent className="p-5">
                <p className="text-sm capitalize text-text-2">
                  {c.category.toLowerCase()}
                </p>
                <h3 className="mt-1 text-2xl font-bold">
                  {formatCurrency(c.total)}
                </h3>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((t) => (
            <Button
              key={t.label}
              size="sm"
              variant={category === t.value ? 'default' : 'outline'}
              onClick={() => setCategory(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <Card className="py-0">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-8 animate-spin text-text-3" />
              </div>
            ) : (page?.data.length ?? 0) === 0 ? (
              <div className="py-16 text-center text-text-3">
                No expenses recorded
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page!.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.expenseDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {e.category.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>
                        {e.paymentMethod.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(e.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Can perm="expenses.manage">
                          <TooltipButton
                            tooltip="Delete expense"
                            variant="ghost"
                            size="icon"
                            onClick={() => del.mutate(e.id)}
                            disabled={del.isPending}
                          >
                            <Trash2 className="size-4 text-text-3" />
                          </TooltipButton>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
