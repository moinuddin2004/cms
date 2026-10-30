import { useState } from 'react'
import { Can } from '@/features/access/components/Can'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Loader2 } from 'lucide-react'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { useSuppliers, useDeleteSupplier } from '../hooks/useSuppliers'
import { useSupplierForm } from '../hooks/useSupplierForm'
import type { Supplier } from '../types'

export function SuppliersTab() {
  const { data: suppliers, isLoading } = useSuppliers()
  const deleteMutation = useDeleteSupplier()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setDialogOpen(true)
  }
  const handleDelete = (s: Supplier) => {
    if (!confirm(`Deactivate supplier "${s.name}"?`)) return
    deleteMutation.mutate(s.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can perm="inventory.po.manage">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        </Can>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contactPerson ?? '—'}</TableCell>
                    <TableCell>{s.phone ?? '—'}</TableCell>
                    <TableCell>{s.email ?? '—'}</TableCell>
                    <TableCell>{s.city ?? '—'}</TableCell>
                    <TableCell>
                      <Can perm="inventory.po.manage">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(s)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(s)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
                {suppliers && suppliers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No suppliers yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editing}
      />
    </div>
  )
}

const SUPPLIER_TEXT_FIELDS = [
  ['contactPerson', 'Contact Person'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['city', 'City'],
] as const

function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  supplier: Supplier | null
}) {
  const { form, isEdit } = useSupplierForm({
    open,
    supplier,
    onDone: () => onOpenChange(false),
  })

  const textField = (
    name:
      | 'name'
      | 'contactPerson'
      | 'phone'
      | 'email'
      | 'city'
      | 'address'
      | 'website',
    label: string,
    required = false,
  ) => (
    <form.Field name={name}>
      {(f) => (
        <FieldWrapper
          label={label}
          htmlFor={`supplier-${name}`}
          required={required}
          error={fieldError(f)}
        >
          <Input
            id={`supplier-${name}`}
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          {textField('name', 'Name', true)}
          <div className="grid grid-cols-2 gap-4">
            {SUPPLIER_TEXT_FIELDS.map(([name, label]) => (
              <div key={name}>{textField(name, label)}</div>
            ))}
          </div>
          {textField('address', 'Address')}
          {textField('website', 'Website')}
          <form.Field name="notes">
            {(f) => (
              <FieldWrapper
                label="Notes"
                htmlFor="supplier-notes"
                error={fieldError(f)}
              >
                <Textarea
                  id="supplier-notes"
                  className="h-16 resize-none"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                  placeholder="Payment terms, delivery schedule…"
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
                  {isEdit ? 'Save Changes' : 'Create Supplier'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  )
}
