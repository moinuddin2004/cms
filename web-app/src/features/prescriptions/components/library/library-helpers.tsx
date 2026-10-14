import { useEffect, useState } from 'react'
import { Pencil, PowerOff } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import type { ServerPagination } from '@/components/shared/DataTable'
import { Pagination } from '@/components/shared'

/** Edit + Deactivate icon buttons used on every Library row and card. */
export function LibraryRowActions({
  noun,
  onEdit,
  onDeactivate,
}: {
  /** "preset", "medicine"… — used in the tooltips. */
  noun: string
  onEdit: () => void
  onDeactivate?: () => void
}) {
  return (
    <div className="flex items-center justify-end">
      <TooltipButton
        tooltip={`Edit ${noun}`}
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
      >
        <Pencil className="size-4" />
      </TooltipButton>
      {onDeactivate && (
        <TooltipButton
          tooltip={`Deactivate ${noun}`}
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDeactivate()
          }}
        >
          <PowerOff className="size-4" />
        </TooltipButton>
      )}
    </div>
  )
}

/** Client-side paging that both the table and the card grid share. */
export function useLocalPaging<T>(items: T[], defaultLimit = 20) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(defaultLimit)

  const total = items.length
  const pages = Math.max(1, Math.ceil(total / limit))
  // A filter can shrink the list under the current page.
  useEffect(() => {
    if (page > pages) setPage(pages)
  }, [page, pages])

  const slice = items.slice((page - 1) * limit, page * limit)
  const pagination: ServerPagination = {
    page,
    pageSize: limit,
    total,
    onPageChange: setPage,
    onPageSizeChange: (size) => {
      setLimit(size)
      setPage(1)
    },
    pageSizeOptions: [10, 20, 50, 100],
  }
  return { slice, pagination, resetPage: () => setPage(1) }
}

/** Pagination bar under a card grid (the table has its own). */
export function CardPagination({
  pagination,
}: {
  pagination: ServerPagination
}) {
  return (
    <Pagination
      page={pagination.page}
      totalPages={Math.max(
        1,
        Math.ceil(pagination.total / pagination.pageSize),
      )}
      limit={pagination.pageSize}
      total={pagination.total}
      onPageChange={pagination.onPageChange}
      onLimitChange={pagination.onPageSizeChange}
      pageSizeOptions={pagination.pageSizeOptions}
    />
  )
}
