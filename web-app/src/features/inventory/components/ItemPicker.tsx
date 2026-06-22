import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Search, Loader2 } from 'lucide-react'
import { useInventoryItems } from '../hooks/useInventory'
import type { InventoryItem } from '../types'

interface ItemPickerProps {
  onSelect: (item: InventoryItem) => void
  placeholder?: string
  /** ids already chosen — shown but de-emphasised */
  selectedIds?: string[]
}

/**
 * Searchable inventory item dropdown. Reused by PO create, template editor
 * and ConsumptionRecorder.
 */
export function ItemPicker({
  onSelect,
  placeholder = 'Search items by name or SKU…',
  selectedIds = [],
}: ItemPickerProps) {
  const [search, setSearch] = useState('')
  const { data: page, isFetching } = useInventoryItems({
    search: search || undefined,
    limit: 8,
  })

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="max-h-44 divide-y overflow-y-auto rounded-md border">
        {isFetching && (
          <div className="p-3 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </div>
        )}
        {page?.data.map((item) => {
          const already = selectedIds.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-center justify-between p-2 text-left text-sm hover:bg-muted/50"
            >
              <span className="flex flex-col">
                <span className="font-medium">
                  {item.name}
                  {already && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (added)
                    </span>
                  )}
                </span>
                {item.sku && (
                  <span className="text-xs text-muted-foreground">
                    {item.sku}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {Number(item.currentStock)} {item.unit}
              </span>
            </button>
          )
        })}
        {!isFetching && (page?.data.length ?? 0) === 0 && (
          <div className="p-3 text-center text-sm text-muted-foreground">
            No items found
          </div>
        )}
      </div>
    </div>
  )
}
