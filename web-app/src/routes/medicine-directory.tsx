import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import {
  MealRelation,
  MEAL_RELATION_OPTIONS,
  MedicineType,
  MEDICINE_TYPE_OPTIONS,
  useCreateMedicine,
  useDeactivateMedicine,
  useMedicines,
  useSeedCommonMedicines,
  useUpdateMedicine,
  type MedicineDirectoryItem,
} from '@/features/prescriptions'

export const Route = createFileRoute('/medicine-directory')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <MedicineDirectoryPage />
    </RequireFeaturePage>
  ),
})

function MedicineDirectoryPage() {
  const { data: medicines = [], isLoading } = useMedicines()
  const seedMutation = useSeedCommonMedicines()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<MedicineDirectoryItem | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return medicines
    const q = search.trim().toLowerCase()
    return medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.genericName?.toLowerCase().includes(q) ?? false),
    )
  }, [medicines, search])

  return (
    <DashboardLayout
      title="Medicine Directory"
      subtitle="Master catalog used by the prescription builder's autocomplete"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Seed common
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add medicine
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Medicines</CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 w-[240px]"
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Generic</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Default freq</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground text-sm"
                  >
                    {medicines.length === 0
                      ? 'No medicines yet — click "Seed common" or "Add medicine".'
                      : 'No matches.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.genericName ?? '—'}
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {m.type.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.strength ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.defaultFrequency ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing(m)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MedicineDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        item={editing}
      />
    </DashboardLayout>
  )
}

function MedicineDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MedicineDirectoryItem | null
}) {
  const create = useCreateMedicine()
  const update = useUpdateMedicine()
  const deactivate = useDeactivateMedicine()
  const isEdit = !!item

  const [name, setName] = useState(item?.name ?? '')
  const [genericName, setGenericName] = useState(item?.genericName ?? '')
  const [nameUrdu, setNameUrdu] = useState(item?.nameUrdu ?? '')
  const [type, setType] = useState<MedicineType>(item?.type ?? MedicineType.TABLET)
  const [strength, setStrength] = useState(item?.strength ?? '')
  const [defaultDosage, setDefaultDosage] = useState(item?.defaultDosage ?? '')
  const [defaultFrequency, setDefaultFrequency] = useState(
    item?.defaultFrequency ?? '',
  )
  const [defaultDuration, setDefaultDuration] = useState(
    item?.defaultDuration ?? '',
  )
  const [defaultMealRelation, setDefaultMealRelation] = useState<MealRelation>(
    item?.defaultMealRelation ?? MealRelation.NONE,
  )

  // Reset when target item changes
  useMemo(() => {
    if (open) {
      setName(item?.name ?? '')
      setGenericName(item?.genericName ?? '')
      setNameUrdu(item?.nameUrdu ?? '')
      setType(item?.type ?? MedicineType.TABLET)
      setStrength(item?.strength ?? '')
      setDefaultDosage(item?.defaultDosage ?? '')
      setDefaultFrequency(item?.defaultFrequency ?? '')
      setDefaultDuration(item?.defaultDuration ?? '')
      setDefaultMealRelation(item?.defaultMealRelation ?? MealRelation.NONE)
    }
  }, [open, item])

  const handleSave = async () => {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      genericName: genericName.trim() || null,
      nameUrdu: nameUrdu.trim() || null,
      type,
      strength: strength.trim() || null,
      defaultDosage: defaultDosage.trim() || null,
      defaultFrequency: defaultFrequency.trim() || null,
      defaultDuration: defaultDuration.trim() || null,
      defaultMealRelation,
    }
    if (isEdit && item) {
      await update.mutateAsync({ id: item.id, data: payload as any })
    } else {
      await create.mutateAsync(payload as any)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit medicine' : 'Add medicine'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Generic</Label>
            <Input
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
            />
          </div>
          <div>
            <Label>Urdu name</Label>
            <Input
              value={nameUrdu}
              onChange={(e) => setNameUrdu(e.target.value)}
              dir="rtl"
              className="text-right"
              style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}
            />
          </div>
          <div>
            <Label>Type *</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as MedicineType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDICINE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Strength</Label>
            <Input
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              placeholder="500mg"
            />
          </div>
          <div>
            <Label>Default dosage</Label>
            <Input
              value={defaultDosage}
              onChange={(e) => setDefaultDosage(e.target.value)}
              placeholder="1"
            />
          </div>
          <div>
            <Label>Default frequency</Label>
            <Input
              value={defaultFrequency}
              onChange={(e) => setDefaultFrequency(e.target.value)}
              placeholder="3 times a day"
            />
          </div>
          <div>
            <Label>Default duration</Label>
            <Input
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(e.target.value)}
              placeholder="5 days"
            />
          </div>
          <div>
            <Label>Default meal relation</Label>
            <Select
              value={defaultMealRelation}
              onValueChange={(v) => setDefaultMealRelation(v as MealRelation)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_RELATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {isEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={deactivate.isPending}
              onClick={async () => {
                if (item) {
                  await deactivate.mutateAsync(item.id)
                  onOpenChange(false)
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Deactivate
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={create.isPending || update.isPending}
            >
              {(create.isPending || update.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {isEdit ? 'Save' : 'Add'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
