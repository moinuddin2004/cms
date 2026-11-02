import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100] as const

interface PaginationProps {
  page: number
  totalPages: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  page,
  totalPages,
  limit,
  total,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [...DEFAULT_PAGE_SIZES],
}: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  const visiblePages = Math.min(totalPages, 5)
  const pageNumbers = Array.from({ length: visiblePages }, (_, i) => {
    if (totalPages <= 5) return i + 1
    if (page <= 3) return i + 1
    if (page >= totalPages - 2) return totalPages - 4 + i
    return page - 2 + i
  })

  return (
    <div className="flex flex-col gap-3 px-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground sm:justify-start">
        <span>
          <span className="hidden sm:inline">Showing </span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {start}–{end}
          </span>{' '}
          of {total}
        </span>
        <span className="mx-1 hidden sm:inline">·</span>
        <div className="flex items-center gap-2">
          <Select
            clearable={false}
            value={String(limit)}
            onValueChange={(v) => onLimitChange(Number(v))}
          >
            <SelectTrigger
              className="w-[75px] h-8 text-xs"
              aria-label="Page size"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs">per page</span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-1">
        <TooltipButton
          variant="outline"
          size="sm"
          className="h-10 flex-1 gap-1 sm:h-8 sm:w-8 sm:flex-none sm:p-0"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          tooltip="Previous page"
        >
          <ChevronLeft size={16} />
          <span className="text-xs sm:hidden">Prev</span>
        </TooltipButton>

        <span className="shrink-0 px-3 text-xs font-medium text-slate-600 dark:text-slate-400 sm:hidden">
          Page {page} of {Math.max(totalPages, 1)}
        </span>

        {pageNumbers.map((pageNum) => (
          <Button
            key={pageNum}
            variant={pageNum === page ? 'default' : 'outline'}
            size="sm"
            className="hidden h-8 w-8 p-0 text-xs sm:inline-flex"
            onClick={() => onPageChange(pageNum)}
          >
            {pageNum}
          </Button>
        ))}

        <TooltipButton
          variant="outline"
          size="sm"
          className="h-10 flex-1 gap-1 sm:h-8 sm:w-8 sm:flex-none sm:p-0"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          tooltip="Next page"
        >
          <span className="text-xs sm:hidden">Next</span>
          <ChevronRight size={16} />
        </TooltipButton>
      </div>
    </div>
  )
}
