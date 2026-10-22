import { useState } from 'react'
import { Can } from '@/features/access/components/Can'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { useInventoryItems, useDeactivateItem } from '../hooks/useInventory'
import { useCategories } from '../hooks/useCategories'
import { StockCell, ExpiryCell } from './inventory-ui'
import { ItemFormDialog } from './ItemFormDialog'
import { AdjustStockDialog } from './AdjustStockDialog'
import { ItemDetailSheet } from './ItemDetailSheet'
import type { InventoryItem } from '../types'

export function ItemsTab() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: categories } = useCategories()
  const { data: response, isLoading } = useInventoryItems({
    search: search || undefined,
    categoryId: categoryId || undefined,
    lowStockOnly: lowStockOnly || undefined,
    expiringOnly: expiringOnly || undefined,
    page,
    limit: 20,
  })
  const deactivate = useDeactivateItem()

  const openCreate = () => {
    setEditItem(null)
    setFormOpen(true)
  }
  const openEdit = (item: InventoryItem) => {
    setEditItem(item)
    setFormOpen(true)
  }
  const handleDeactivate = (item: InventoryItem) => {
    if (!confirm(`Deactivate "${item.name}"?`)) return
    deactivate.mutate(item.id)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={categoryId || 'all'}
            onValueChange={(v) => {
              setCategoryId(v === 'all' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={lowStockOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setLowStockOnly((v) => !v)
              setPage(1)
            }}
          >
            Low Stock
          </Button>
          <Button
            variant={expiringOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setExpiringOnly((v) => !v)
              setPage(1)
            }}
          >
            Expiring
          </Button>
        </div>
        <Can perm="inventory.stock.adjust">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </Can>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {response?.data.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(item.id)}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.sku ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.category?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StockCell item={item} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(item.unitPrice))}
                    </TableCell>
                    <TableCell>
                      <ExpiryCell date={item.expiryDate} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Can perm="inventory.stock.adjust">
                            <DropdownMenuItem onClick={() => openEdit(item)}>
                              Edit item
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setAdjustItem(item)}
                            >
                              Adjust stock
                            </DropdownMenuItem>
                          </Can>
                          <DropdownMenuItem
                            onClick={() => setDetailId(item.id)}
                          >
                            View movements
                          </DropdownMenuItem>
                          <Can perm="inventory.stock.adjust">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeactivate(item)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          </Can>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {response && response.data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {response && response.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {response.page} of {response.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= response.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <ItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
      />
      <AdjustStockDialog
        open={!!adjustItem}
        onOpenChange={(o) => !o && setAdjustItem(null)}
        item={adjustItem}
      />
      <ItemDetailSheet
        itemId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onAdjust={(item) => {
          setDetailId(null)
          setAdjustItem(item)
        }}
        onEdit={(item) => {
          setDetailId(null)
          openEdit(item)
        }}
      />
    </div>
  )
}
