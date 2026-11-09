import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table'
import type {
  ColumnDef as TanStackColumnDef,
  RowData,
} from '@tanstack/react-table'

/**
 * Feature set shared by every DataTable instance.
 *
 * Table v9 needs features and row models to be declared statically so unused
 * features can be tree-shaken. This replaces the row-model factories that v8
 * used to pass to useReactTable.
 *
 * The sortFns registry mirrors the v8 built-in defaults so `sortFn: 'auto'`
 * and the named `basic` / `alphanumeric` sort functions resolve identically.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
})

export type DataTableFeatures = typeof dataTableFeatures

/**
 * Column definition with this table's feature set pre-bound, so column modules
 * keep the familiar `ColumnDef<TData, TValue>` shape from v8.
 */
export type ColumnDef<
  TData extends RowData,
  TValue = unknown,
> = TanStackColumnDef<DataTableFeatures, TData, TValue>
