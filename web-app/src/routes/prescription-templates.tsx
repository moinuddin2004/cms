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
import { Switch } from '@/components/ui/switch'
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
  PageSize,
  useCreatePrescriptionTemplate,
  useDeactivatePrescriptionTemplate,
  usePrescriptionTemplates,
  useUpdatePrescriptionTemplate,
  PrescriptionPreview,
  type PrescriptionTemplate,
} from '@/features/prescriptions'

export const Route = createFileRoute('/prescription-templates')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <PrescriptionTemplatesPage />
    </RequireFeaturePage>
  ),
})

function PrescriptionTemplatesPage() {
  const { data: templates = [], isLoading } = usePrescriptionTemplates()
  const [editing, setEditing] = useState<PrescriptionTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <DashboardLayout
      title="Prescription Layouts"
      backTo="/prescriptions"
      backLabel="Back to prescriptions"
      subtitle="Per-branch PDF templates for printed prescriptions"
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New layout
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layouts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Default</TableHead>
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
                    No layouts yet — create one so prescriptions print with
                    your clinic branding.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.pageSize} · {t.orientation.toLowerCase()}
                    </TableCell>
                    <TableCell>
                      {t.isDefault ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                          Default
                        </Badge>
                      ) : (
                        '—'
                      )}
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

      <LayoutDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        layout={editing}
      />
    </DashboardLayout>
  )
}

function LayoutDialog({
  open,
  onOpenChange,
  layout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  layout: PrescriptionTemplate | null
}) {
  const create = useCreatePrescriptionTemplate()
  const update = useUpdatePrescriptionTemplate()
  const deactivate = useDeactivatePrescriptionTemplate()
  const isEdit = !!layout

  const [name, setName] = useState('')
  const [pageSize, setPageSize] = useState<PageSize>(PageSize.A4)
  const [isDefault, setIsDefault] = useState(false)
  const [header, setHeader] = useState<Record<string, any>>({})
  const [footer, setFooter] = useState<Record<string, any>>({})
  const [styling, setStyling] = useState<Record<string, any>>({
    primaryColor: '#0d9488',
    showVitals: true,
    showMedicineUrdu: true,
  })

  useEffect(() => {
    if (!open) return
    if (layout) {
      setName(layout.name)
      setPageSize(layout.pageSize)
      setIsDefault(layout.isDefault)
      setHeader(layout.header ?? {})
      setFooter(layout.footer ?? {})
      setStyling(layout.styling ?? {})
    } else {
      setName('')
      setPageSize(PageSize.A4)
      setIsDefault(false)
      setHeader({})
      setFooter({})
      setStyling({
        primaryColor: '#0d9488',
        showVitals: true,
        showMedicineUrdu: true,
      })
    }
  }, [open, layout])

  const handleSave = async () => {
    if (!name.trim()) return
    const payload: any = { name: name.trim(), pageSize, isDefault, header, footer, styling }
    if (isEdit && layout) {
      await update.mutateAsync({ id: layout.id, data: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onOpenChange(false)
  }

  const previewTemplate: PrescriptionTemplate = {
    id: 'preview',
    organizationId: '',
    locationId: null,
    name,
    isDefault,
    pageSize,
    orientation: 'PORTRAIT' as any,
    customWidthMm: null,
    customHeightMm: null,
    header,
    footer,
    styling,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit layout' : 'New layout'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Page size</Label>
                <Select
                  value={pageSize}
                  onValueChange={(v) => setPageSize(v as PageSize)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PageSize.A4}>A4</SelectItem>
                    <SelectItem value={PageSize.A5}>A5</SelectItem>
                    <SelectItem value={PageSize.LETTER}>Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Primary color</Label>
                <Input
                  type="color"
                  value={styling.primaryColor ?? '#0d9488'}
                  onChange={(e) =>
                    setStyling({ ...styling, primaryColor: e.target.value })
                  }
                  className="h-9 p-1"
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                  id="default-switch"
                />
                <Label htmlFor="default-switch" className="text-xs">
                  Default
                </Label>
              </div>
            </div>

            <fieldset className="border rounded-md p-3 space-y-2">
              <legend className="text-xs uppercase tracking-wider text-muted-foreground px-1">
                Header
              </legend>
              <Input
                value={header.clinicName ?? ''}
                onChange={(e) =>
                  setHeader({ ...header, clinicName: e.target.value })
                }
                placeholder="Clinic name"
              />
              <Input
                value={header.clinicNameUrdu ?? ''}
                onChange={(e) =>
                  setHeader({ ...header, clinicNameUrdu: e.target.value })
                }
                placeholder="کلینک کا نام"
                dir="rtl"
                className="text-right"
                style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={header.doctorQualification ?? ''}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      doctorQualification: e.target.value,
                    })
                  }
                  placeholder="MBBS, FCPS"
                />
                <Input
                  value={header.registrationNumber ?? ''}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      registrationNumber: e.target.value,
                    })
                  }
                  placeholder="PMC #"
                />
              </div>
              <Input
                value={header.doctorPhone ?? ''}
                onChange={(e) =>
                  setHeader({ ...header, doctorPhone: e.target.value })
                }
                placeholder="Doctor phone"
              />
            </fieldset>

            <fieldset className="border rounded-md p-3 space-y-2">
              <legend className="text-xs uppercase tracking-wider text-muted-foreground px-1">
                Footer
              </legend>
              <Textarea
                value={footer.address ?? ''}
                onChange={(e) =>
                  setFooter({ ...footer, address: e.target.value })
                }
                placeholder="Address"
                className="h-14 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={footer.timings ?? ''}
                  onChange={(e) =>
                    setFooter({ ...footer, timings: e.target.value })
                  }
                  placeholder="Mon–Sat 9 AM – 9 PM"
                />
                <Input
                  value={footer.phone ?? ''}
                  onChange={(e) =>
                    setFooter({ ...footer, phone: e.target.value })
                  }
                  placeholder="Clinic phone"
                />
              </div>
              <Input
                value={footer.disclaimerText ?? ''}
                onChange={(e) =>
                  setFooter({ ...footer, disclaimerText: e.target.value })
                }
                placeholder="Disclaimer (optional)"
              />
            </fieldset>

            <fieldset className="border rounded-md p-3 grid grid-cols-2 gap-2">
              <legend className="text-xs uppercase tracking-wider text-muted-foreground px-1">
                Toggles
              </legend>
              <Toggle
                label="Show vitals"
                value={styling.showVitals !== false}
                onChange={(v) => setStyling({ ...styling, showVitals: v })}
              />
              <Toggle
                label="Show Urdu medicine"
                value={styling.showMedicineUrdu !== false}
                onChange={(v) =>
                  setStyling({ ...styling, showMedicineUrdu: v })
                }
              />
              <Toggle
                label="Show patient gender"
                value={styling.showPatientGender !== false}
                onChange={(v) =>
                  setStyling({ ...styling, showPatientGender: v })
                }
              />
              <Toggle
                label="Show date"
                value={styling.showDate !== false}
                onChange={(v) => setStyling({ ...styling, showDate: v })}
              />
            </fieldset>
          </div>

          {/* Live preview */}
          <div className="bg-muted/30 rounded-lg p-3 border max-h-[80vh] overflow-y-auto">
            <PrescriptionPreview
              data={{
                patient: {
                  id: '',
                  fullName: 'Manahil Ahmed',
                  patientNumber: 'P-001',
                  phone: '0300-1234567',
                  gender: 'female',
                  dob: '2002-04-12',
                },
                doctor: {
                  id: '',
                  fullName: 'Ali Khan',
                  designation: 'Senior Dentist',
                },
                medicines: [
                  {
                    medicineName: 'Panadol 500mg Tab',
                    medicineNameUrdu: 'پینا ڈول',
                    dosage: '1',
                    frequency: '3 times a day',
                    duration: '5 days',
                    mealRelation: 'AFTER_MEAL' as any,
                  },
                ],
                instructionsEnglish: 'Drink plenty of water. Rest as needed.',
                instructionsUrdu: 'وافر مقدار میں پانی پیئیں۔',
                createdAt: new Date().toISOString(),
              }}
              template={previewTemplate}
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
                if (layout) {
                  await deactivate.mutateAsync(layout.id)
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

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <Switch checked={value} onCheckedChange={onChange} />
      {label}
    </label>
  )
}
