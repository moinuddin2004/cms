import { useState } from 'react'
import { PieChart, Receipt, Tag, Trash2, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { formatInClinic, nowInClinic } from '@/lib/datetime'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
} from '@/components/shared'
import {
  useExpenses,
  useExpenseSummary,
  useDeleteExpense,
} from '@/features/billing/hooks/useExpenses'
import { Can } from '@/features/access'
import { ExpenseFormDialog } from '@/features/billing/components/ExpenseFormDialog'
import { ExpenseCategory } from '@/features/billing/types'
import type { Expense } from '@/features/billing/types'

const ALL = 'ALL'

const CATEGORY_TONES = [
  'bg-violet-soft text-violet',
  'bg-amber-soft text-amber',
  'bg-emerald-soft text-emerald',
]

/** Grid columns for the stats strip, by how many cells it has. */
const STAT_COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

const titleCase = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')

const CATEGORY_TABS: Array<{ label: string; value: string }> = [
  { label: 'All', value: ALL },
  ...Object.values(ExpenseCategory).map((c) => ({
    label: titleCase(c),
    value: c,
  })),
]

export function ExpensesPage() {
  const now = nowInClinic()
  const [tab, setTab] = useState<string>(ALL)
  const category = tab === ALL ? undefined : (tab as ExpenseCategory)
  const expenses = useExpenses({ category, limit: 30 })
  const summaryQuery = useExpenseSummary(now.getMonth() + 1, now.getFullYear())
  const summary = summaryQuery.data
  const del = useDeleteExpense()
  const [deleting, setDeleting] = useState<Expense | null>(null)

  const rows = expenses.data?.data ?? []
  const topCategories = [...(summary?.byCategory ?? [])]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
  const monthLabel = formatInClinic(now, 'MMMM')

  const stats = [
    {
      label: `${monthLabel} total`,
      value: formatCurrency(summary?.grandTotal ?? 0),
      icon: Wallet,
      tone: 'bg-primary-soft text-primary-text',
    },
    ...(topCategories.length
      ? topCategories.map((c, i) => ({
          label: titleCase(c.category),
          value: formatCurrency(c.total),
          icon: i === 0 ? PieChart : Tag,
          tone: CATEGORY_TONES[i],
        }))
      : [
          {
            label: 'Top category',
            value: 'None yet',
            icon: PieChart,
            tone: CATEGORY_TONES[0],
          },
        ]),
  ]

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
        {/* Same compact strip as the appointments stats */}
        <div
          className={`grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:divide-y-0 ${STAT_COLS[stats.length]}`}
        >
          {stats.map(({ label, value, icon: Icon, tone }, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/40"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 leading-none">
                <p className="truncate text-[11px] font-medium text-text-3">
                  {label}
                </p>
                {summaryQuery.isLoading ? (
                  <Skeleton className="mt-1 h-4 w-16" />
                ) : (
                  <p className="mt-1 truncate text-base leading-none font-bold tabular-nums">
                    {value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
            <TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-muted/50 p-1">
              {CATEGORY_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="flex-none px-3"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <Card className="py-0">
          <CardContent className="p-0">
            {expenses.isLoading ? (
              <LoadingSkeleton variant="table" rows={5} className="p-4" />
            ) : expenses.isError ? (
              <ErrorState
                description="Could not load expenses."
                onRetry={() => void expenses.refetch()}
              />
            ) : rows.length === 0 ? (
              category ? (
                <NoResultsState
                  message={`No ${titleCase(category).toLowerCase()} expenses yet.`}
                  onClear={() => setTab(ALL)}
                />
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No expenses recorded"
                  description="Record rent, supplies, salaries and other spending to see where money goes."
                  action={
                    <Can perm="expenses.manage">
                      <ExpenseFormDialog />
                    </Can>
                  }
                />
              )
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow
                      key={e.id}
                      className="transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                        {formatDate(e.expenseDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="muted">{titleCase(e.category)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate font-medium">
                        {e.description}
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {e.paymentMethod.replace(/_/g, ' ').toLowerCase()}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(e.amount)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Can perm="expenses.manage">
                          <TooltipButton
                            tooltip="Delete expense"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleting(e)}
                          >
                            <Trash2 className="size-4" />
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this expense?"
        description={
          deleting
            ? `${deleting.description} (${formatCurrency(deleting.amount)}) will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        isLoading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </PageWrapper>
  )
}
