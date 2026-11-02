import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/shared/DatePicker'
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
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { Loader2 } from 'lucide-react'
import { useCategories } from '../hooks/useCategories'
import { useItemForm } from '../hooks/useItemForm'
import { ITEM_UNITS } from '../types'
import type { InventoryItem, ItemUnit } from '../types'

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem | null
}

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
}: ItemFormDialogProps) {
  const { data: categories } = useCategories()
  const { form, isEdit } = useItemForm({
    open,
    item,
    onDone: () => onOpenChange(false),
  })

  const numberField = (
    name: 'initialStock' | 'unitPrice' | 'reorderLevel' | 'sellingPrice',
    label: string,
  ) => (
    <form.Field name={name}>
      {(f) => (
        <FieldWrapper
          label={label}
          htmlFor={`item-${name}`}
          error={fieldError(f)}
        >
          <NumberInput
            id={`item-${name}`}
            mode="decimal"
            value={f.state.value}
            onChange={(e) => f.handleChange(e.target.value)}
            onBlur={f.handleBlur}
            aria-invalid={!!fieldError(f)}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'Add Item'}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="name">
            {(f) => (
              <FieldWrapper
                label="Name"
                htmlFor="item-name"
                required
                error={fieldError(f)}
              >
                <Input
                  id="item-name"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                  placeholder="Disposable Gloves (Medium)"
                  aria-invalid={!!fieldError(f)}
                />
              </FieldWrapper>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="sku">
              {(f) => (
                <FieldWrapper
                  label="SKU"
                  htmlFor="item-sku"
                  error={fieldError(f)}
                >
                  <Input
                    id="item-sku"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    placeholder="GLV-M-001"
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="categoryId">
              {(f) => (
                <FieldWrapper label="Category" error={fieldError(f)}>
                  <Select
                    value={f.state.value || 'none'}
                    onValueChange={(v) => f.handleChange(v === 'none' ? '' : v)}
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
                </FieldWrapper>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {!isEdit && numberField('initialStock', 'Initial Stock')}
            <form.Field name="unit">
              {(f) => (
                <FieldWrapper label="Unit" error={fieldError(f)}>
                  <Select
                    clearable={false}
                    value={f.state.value}
                    onValueChange={(v) => f.handleChange(v as ItemUnit)}
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
                </FieldWrapper>
              )}
            </form.Field>
            {numberField('unitPrice', 'Cost Price')}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {numberField('reorderLevel', 'Reorder Level')}
            <form.Field name="expiryDate">
              {(f) => (
                <FieldWrapper label="Expiry Date" error={fieldError(f)}>
                  <DatePicker
                    value={f.state.value}
                    onChange={(v) => f.handleChange(v)}
                    clearable
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>

          <form.Field name="isBillable">
            {(f) => (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Billable to patient</Label>
                  <p className="text-xs text-muted-foreground">
                    Can be added to a patient invoice
                  </p>
                </div>
                <Switch
                  checked={f.state.value}
                  onCheckedChange={(v) => f.handleChange(v)}
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.isBillable}>
            {(isBillable) =>
              isBillable && numberField('sellingPrice', 'Selling Price')
            }
          </form.Subscribe>

          <form.Field name="description">
            {(f) => (
              <FieldWrapper
                label="Description"
                htmlFor="item-description"
                error={fieldError(f)}
              >
                <Textarea
                  id="item-description"
                  className="h-16 resize-none"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEdit ? 'Save Changes' : 'Create Item'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  )
}
