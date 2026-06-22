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
import { toast } from 'sonner'
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
} from '../hooks/useSuppliers'
import type { Supplier, SupplierFormData } from '../types'

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
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Supplier
        </Button>
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

const emptyForm: SupplierFormData = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  website: '',
  notes: '',
}

function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  supplier: Supplier | null
}) {
  const isEdit = !!supplier
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const [form, setForm] = useState<SupplierFormData>({ ...emptyForm })

  useEffect(() => {
    if (open) {
      setForm(
        supplier
          ? {
              name: supplier.name,
              contactPerson: supplier.contactPerson ?? '',
              phone: supplier.phone ?? '',
              email: supplier.email ?? '',
              address: supplier.address ?? '',
              city: supplier.city ?? '',
              website: supplier.website ?? '',
              notes: supplier.notes ?? '',
            }
          : { ...emptyForm },
      )
    }
  }, [open, supplier])

  const set = (patch: Partial<SupplierFormData>) =>
    setForm((prev) => ({ ...prev, ...patch }))
  const isPending = createMutation.isPending || updateMutation.isPending

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    const payload: SupplierFormData = {
      ...form,
      name: form.name.trim(),
    }
    if (isEdit && supplier) {
      updateMutation.mutate(
        { id: supplier.id, payload },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createMutation.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => set({ contactPerson: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => set({ website: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              className="h-16 resize-none"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Payment terms, delivery schedule…"
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
              {isEdit ? 'Save Changes' : 'Create Supplier'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
