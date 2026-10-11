import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
} from '@/components/ui/select'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  MealRelation,
  MEAL_RELATION_OPTIONS,
  useCreateTreatmentPlanTemplate,
  useDeactivateTreatmentPlanTemplate,
  useTreatmentPlanTemplates,
  useUpdateTreatmentPlanTemplate,
  MedicineAutocomplete,
  medicineFromDirectory,
  FREQUENCY_PRESETS,
  DURATION_PRESETS,
  type TreatmentPlanTemplate,
  type TreatmentPlanTemplateMedicine,
} from '@/features/prescriptions'

export const Route = createFileRoute('/treatment-plan-templates')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <TreatmentPlanTemplatesPage />
    </RequireFeaturePage>
  ),
})

type DraftMedicine = Partial<TreatmentPlanTemplateMedicine> & {
  medicineName: string
  dosage: string
  frequency: string
  duration: string
  mealRelation: MealRelation
}

function emptyMed(): DraftMedicine {
  return {
    medicineName: '',
    dosage: '1',
    frequency: '',
    mealRelation: MealRelation.NONE,
    duration: '',
  }
}

function TreatmentPlanTemplatesPage() {
  const { data: templates = [], isLoading } = useTreatmentPlanTemplates()
  const [editing, setEditing] = useState<TreatmentPlanTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <DashboardLayout
      title="Treatment Plan Templates"
      backTo="/prescriptions"
      backLabel="Back to prescriptions"
      subtitle="Reusable prescription presets per condition"
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New template
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Medicines</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No templates yet — create one to speed up repeat
                    prescriptions.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.medicines.length} medicine
                      {t.medicines.length === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing(t)}
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

      <TemplateDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        template={editing}
      />
    </DashboardLayout>
  )
}

function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: TreatmentPlanTemplate | null
}) {
  const create = useCreateTreatmentPlanTemplate()
  const update = useUpdateTreatmentPlanTemplate()
  const deactivate = useDeactivateTreatmentPlanTemplate()
  const isEdit = !!template

  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [description, setDescription] = useState('')
  const [furtherPlan, setFurtherPlan] = useState('')
  const [instructionsEnglish, setInstructionsEnglish] = useState('')
  const [instructionsUrdu, setInstructionsUrdu] = useState('')
  const [medicines, setMedicines] = useState<DraftMedicine[]>([emptyMed()])

  useEffect(() => {
    if (!open) return
    if (template) {
      setName(template.name)
      setCategory(template.category)
      setDescription(template.description ?? '')
      setFurtherPlan(template.furtherPlan ?? '')
      setInstructionsEnglish(template.instructionsEnglish ?? '')
      setInstructionsUrdu(template.instructionsUrdu ?? '')
      setMedicines(
        template.medicines.length > 0
          ? template.medicines.map((m) => ({ ...m }))
          : [emptyMed()],
      )
    } else {
      setName('')
      setCategory('General')
      setDescription('')
      setFurtherPlan('')
      setInstructionsEnglish('')
      setInstructionsUrdu('')
      setMedicines([emptyMed()])
    }
  }, [open, template])

  const handleSave = async () => {
    if (!name.trim()) return
    const cleanMeds = medicines.filter((m) => m.medicineName.trim())
    if (cleanMeds.length === 0) return
    const payload: any = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || null,
      furtherPlan: furtherPlan.trim() || null,
      instructionsEnglish: instructionsEnglish.trim() || null,
      instructionsUrdu: instructionsUrdu.trim() || null,
      medicines: cleanMeds.map((m, idx) => ({ ...m, sortOrder: idx })),
    }
    if (isEdit && template) {
      await update.mutateAsync({ id: template.id, data: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit template' : 'New template'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Category *</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Dental, Skin, Post-op…"
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-16 resize-none"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">
              Medicines ({medicines.length})
            </Label>
            <div className="space-y-2 mt-1.5">
              {medicines.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded-md border bg-muted/20 p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono w-5 text-center">
                      {idx + 1}.
                    </span>
                    <div className="flex-1">
                      <MedicineAutocomplete
                        value={m.medicineName}
                        onChange={(v) => {
                          const next = [...medicines]
                          next[idx] = { ...m, medicineName: v }
                          setMedicines(next)
                        }}
                        onPick={(picked) => {
                          const seeded = medicineFromDirectory(picked)
                          const next = [...medicines]
                          next[idx] = {
                            ...m,
                            ...seeded,
                            mealRelation:
                              seeded.mealRelation ?? MealRelation.NONE,
                          }
                          setMedicines(next)
                        }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        const next = medicines.filter((_, i) => i !== idx)
                        setMedicines(next.length > 0 ? next : [emptyMed()])
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-12 gap-2 pl-7">
                    <Input
                      className="col-span-2 h-8 text-xs"
                      value={m.dosage}
                      onChange={(e) => {
                        const next = [...medicines]
                        next[idx] = { ...m, dosage: e.target.value }
                        setMedicines(next)
                      }}
                      placeholder="Dose"
                    />
                    <Input
                      className="col-span-4 h-8 text-xs"
                      list={`freq-presets-${idx}`}
                      value={m.frequency}
                      onChange={(e) => {
                        const next = [...medicines]
                        next[idx] = { ...m, frequency: e.target.value }
                        setMedicines(next)
                      }}
                      placeholder="Frequency"
                    />
                    <datalist id={`freq-presets-${idx}`}>
                      {FREQUENCY_PRESETS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                    <Select
                      value={m.mealRelation}
                      onValueChange={(v) => {
                        const next = [...medicines]
                        next[idx] = { ...m, mealRelation: v as MealRelation }
                        setMedicines(next)
                      }}
                    >
                      <SelectTrigger className="col-span-3 h-8 text-xs">
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
                    <Input
                      className="col-span-3 h-8 text-xs"
                      list={`dur-presets-${idx}`}
                      value={m.duration}
                      onChange={(e) => {
                        const next = [...medicines]
                        next[idx] = { ...m, duration: e.target.value }
                        setMedicines(next)
                      }}
                      placeholder="Duration"
                    />
                    <datalist id={`dur-presets-${idx}`}>
                      {DURATION_PRESETS.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMedicines([...medicines, emptyMed()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add medicine
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Instructions (English)</Label>
              <Textarea
                value={instructionsEnglish}
                onChange={(e) => setInstructionsEnglish(e.target.value)}
                className="h-20 resize-none"
              />
            </div>
            <div>
              <Label>Instructions (Urdu)</Label>
              <Textarea
                value={instructionsUrdu}
                onChange={(e) => setInstructionsUrdu(e.target.value)}
                dir="rtl"
                className="h-20 resize-none text-right"
                style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}
              />
            </div>
          </div>
          <div>
            <Label>Further plan</Label>
            <Textarea
              value={furtherPlan}
              onChange={(e) => setFurtherPlan(e.target.value)}
              className="h-16 resize-none"
              placeholder="Follow up in 7 days…"
            />
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
                if (template) {
                  await deactivate.mutateAsync(template.id)
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
              {isEdit ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
