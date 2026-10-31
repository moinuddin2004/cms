import { useState, memo } from 'react'
import { useTable, flexRender } from '@tanstack/react-table'
import type { RowData, SortingState } from '@tanstack/react-table'
import { dataTableFeatures } from './table-features'
import type { ColumnDef } from './table-features'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/data-display/Pagination'
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

// Pass this when the API owns pagination (server-side).
export interface ServerPagination {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  // Loading
  isLoading?: boolean
  skeletonRows?: number
  // Client-side pagination (default on)
  pagination?: boolean
  defaultPageSize?: number
  pageSizeOptions?: number[]
  // Server-side pagination — overrides client pagination when provided
  serverPagination?: ServerPagination
  // Toolbar slot — renders above the table
  toolbar?: React.ReactNode
  // Empty state
  emptyMessage?: string
  emptyAction?: React.ReactNode
  // Row interaction
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string | undefined
  className?: string
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc')
    return <ChevronUp className="ml-1.5 h-3.5 w-3.5 text-foreground" />
  if (isSorted === 'desc')
    return <ChevronDown className="ml-1.5 h-3.5 w-3.5 text-foreground" />
  return (
    <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
  )
}

function DataTableInner<TData extends RowData>({
  columns,
  data,
  isLoading = false,
  skeletonRows = 8,
  pagination = true,
  defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  serverPagination,
  toolbar,
  emptyMessage = 'No results found.',
  emptyAction,
  onRowClick,
  getRowClassName,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const isServerPaginated = !!serverPagination
  // v9 registers row models statically, so disabling client pagination means
  // skipping the pagination stage at runtime instead of omitting the row model.
  const isManuallyPaginated = isServerPaginated || !pagination

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: {
      sorting,
      ...(isServerPaginated && {
        pagination: {
          pageIndex: serverPagination.page - 1,
          pageSize: serverPagination.pageSize,
        },
      }),
    },
    initialState: {
      pagination: { pageIndex: 0, pageSize: defaultPageSize },
    },
    manualPagination: isManuallyPaginated,
    pageCount: isServerPaginated
      ? Math.max(1, Math.ceil(serverPagination.total / serverPagination.pageSize))
      : undefined,
    onSortingChange: setSorting,
  })

  // ─── Pagination props ────────────────────────────────────────────────
  const showPagination = pagination || isServerPaginated

  const clientPageIndex = table.state.pagination.pageIndex
  const clientPageSize = table.state.pagination.pageSize
  const clientTotal = table.getCoreRowModel().rows.length
  const clientTotalPages = table.getPageCount()

  const paginationProps = isServerPaginated
    ? {
        page: serverPagination.page,
        totalPages: Math.max(
          1,
          Math.ceil(serverPagination.total / serverPagination.pageSize),
        ),
        limit: serverPagination.pageSize,
        total: serverPagination.total,
        onPageChange: serverPagination.onPageChange,
        onLimitChange: serverPagination.onPageSizeChange,
        pageSizeOptions: serverPagination.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS,
      }
    : {
        page: clientPageIndex + 1,
        totalPages: clientTotalPages,
        limit: clientPageSize,
        total: clientTotal,
        onPageChange: (p: number) => table.setPageIndex(p - 1),
        onLimitChange: (size: number) => table.setPageSize(size),
        pageSizeOptions,
      }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Toolbar slot */}
      {toolbar && <div className="flex items-center gap-3">{toolbar}</div>}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted dark:bg-accent/60 hover:bg-muted dark:hover:bg-accent/60 border-b border-border"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground select-none whitespace-nowrap',
                        canSort &&
                          'group cursor-pointer hover:text-foreground transition-colors',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <SortIcon isSorted={header.column.getIsSorted()} />}
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i} className="border-b border-border-soft dark:border-border">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-4 py-3">
                      <Skeleton className="h-5 w-full rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    'border-b border-border-soft dark:border-border hover:bg-muted dark:hover:bg-accent/50 transition-colors',
                    onRowClick && 'cursor-pointer',
                    getRowClassName?.(row.original),
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-30" />
                    <p className="text-sm">{emptyMessage}</p>
                    {emptyAction && <div className="mt-1">{emptyAction}</div>}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Shared Pagination component */}
      {showPagination && !isLoading && paginationProps.total > 0 && (
        <Pagination {...paginationProps} />
      )}
    </div>
  )
}

export const DataTable = memo(DataTableInner) as typeof DataTableInner
