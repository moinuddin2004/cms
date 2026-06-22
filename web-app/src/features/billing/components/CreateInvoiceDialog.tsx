import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/formatters'
import { usePatients } from '@/features/patients/hooks/usePatients'
import { useCreateInvoice } from '../hooks/useInvoices'

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
}

export function CreateInvoiceDialog() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const { data: patientsPage, isFetching } = usePatients({
    limit: 8,
    search: search || undefined,
  })
  const { mutate, isPending } = useCreateInvoice()

  const subtotal = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  )

  const reset = () => {
    setPatient(null)
    setSearch('')
    setItems([{ description: '', quantity: 1, unitPrice: 0 }])
    setDueDate('')
    setNotes('')
  }

  const setItem = (idx: number, patch: Partial<LineItem>) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    )

  const submit = (sendAfter: boolean) => {
    if (!patient) {
      toast.error('Select a patient first')
      return
    }
    const validItems = items.filter(
      (it) => it.description.trim() && it.unitPrice >= 0,
    )
    if (validItems.length === 0) {
      toast.error('Add at least one line item')
      return
    }
    mutate(
      {
        patientId: patient.id,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        items: validItems.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
        })),
      },
      {
        onSuccess: () => {
          reset()
          setOpen(false)
          if (sendAfter) {
            toast.message('Invoice created as draft — open it to send.')
          }
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Patient picker */}
          <div className="space-y-2">
            <Label>
              Patient <span className="text-destructive">*</span>
            </Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm font-medium">{patient.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPatient(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search patient by name or phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                  {isFetching && (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {patientsPage?.data.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setPatient({ id: p.id, name: p.fullName })
                      }
                      className="flex w-full items-center justify-between p-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span>{p.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.phone}
                      </span>
                    </button>
                  ))}
                  {!isFetching && (patientsPage?.data.length ?? 0) === 0 && (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      No patients found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>Line Items</Label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) =>
                        setItem(idx, { description: e.target.value })
                      }
                    />
                  </div>
                  <div className="w-16">
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) =>
                        setItem(idx, { quantity: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Unit price"
                      value={it.unitPrice}
                      onChange={(e) =>
                        setItem(idx, { unitPrice: Number(e.target.value) })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { description: '', quantity: 1, unitPrice: 0 },
                ])
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add line
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex items-end justify-end">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="text-lg font-bold">{formatCurrency(subtotal)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              className="h-16 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => submit(false)} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save as Draft
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
