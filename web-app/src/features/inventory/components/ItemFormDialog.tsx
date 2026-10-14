import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCategories } from '../hooks/useCategories'
import { useCreateItem, useUpdateItem } from '../hooks/useInventory'
import { ITEM_UNITS, type InventoryItem, type ItemUnit } from '../types'

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem | null
}

const emptyForm = {
  name: '',
  sku: '',
  categoryId: '',
  initialStock: 0,
  unit: 'pieces' as ItemUnit,
  unitPrice: 0,
  sellingPrice: '' as number | '',
  reorderLevel: 10,
  expiryDate: '',
  description: '',
  isBillable: false,
}

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
}: ItemFormDialogProps) {
  const isEdit = !!item
  const { data: categories } = useCategories()
  const createMutation = useCreateItem()
  const updateMutation = useUpdateItem()
  const [form, setForm] = useState({ ...emptyForm })

  useEffect(() => {
    if (open) {
      if (item) {
        setForm({
          name: item.name,
          sku: item.sku ?? '',
          categoryId: item.categoryId ?? '',
          initialStock: 0,
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          sellingPrice: item.sellingPrice != null ? Number(item.sellingPrice) : '',
          reorderLevel: Number(item.reorderLevel),
          expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : '',
          description: item.description ?? '',
          isBillable: item.isBillable,
        })
      } else {
        setForm({ ...emptyForm })
      }
    }
  }, [open, item])

  const set = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  const isPending = createMutation.isPending || updateMutation.isPending

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    const common = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      categoryId: form.categoryId || undefined,
      unit: form.unit,
      unitPrice: Number(form.unitPrice) || 0,
      sellingPrice:
        form.sellingPrice === '' ? undefined : Number(form.sellingPrice),
      reorderLevel: Number(form.reorderLevel) || 0,
      expiryDate: form.expiryDate || undefined,
      description: form.description.trim() || undefined,
      isBillable: form.isBillable,
    }

    if (isEdit && item) {
      updateMutation.mutate(
        { id: item.id, payload: common },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createMutation.mutate(
        { ...common, initialStock: Number(form.initialStock) || 0 },
        { onSuccess: () => onOpenChange(false) },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'Add Item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Disposable Gloves (Medium)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="GLV-M-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.categoryId || 'none'}
                onValueChange={(v) => set({ categoryId: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {!isEdit && (
              <div className="space-y-2">
                <Label>Initial Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.initialStock}
                  onChange={(e) =>
                    set({ initialStock: Number(e.target.value) })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => set({ unit: v as ItemUnit })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cost Price</Label>
              <Input
                type="number"
                min={0}
                value={form.unitPrice}
                onChange={(e) => set({ unitPrice: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reorder Level</Label>
              <Input
                type="number"
                min={0}
                value={form.reorderLevel}
                onChange={(e) => set({ reorderLevel: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => set({ expiryDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Billable to patient</Label>
              <p className="text-xs text-muted-foreground">
                Can be added to a patient invoice
              </p>
            </div>
            <Switch
              checked={form.isBillable}
              onCheckedChange={(v) => set({ isBillable: v })}
            />
          </div>

          {form.isBillable && (
            <div className="space-y-2">
              <Label>Selling Price</Label>
              <Input
                type="number"
                min={0}
                value={form.sellingPrice}
                onChange={(e) =>
                  set({
                    sellingPrice:
                      e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              className="h-16 resize-none"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
