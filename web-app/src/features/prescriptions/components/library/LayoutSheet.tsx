import { useEffect } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { FormInput } from '@/components/forms/FormInput'
import { FormSelect } from '@/components/forms/FormSelect'
import { FormTextarea } from '@/components/forms/FormTextarea'
import { FormSection, FormSheet } from '@/components/forms/FormSheet'
import { MealRelation, PageOrientation, PageSize } from '../../types'
import type { PrescriptionTemplate } from '../../types'
import {
  useCreatePrescriptionTemplate,
  useUpdatePrescriptionTemplate,
} from '../../hooks/usePrescriptionTemplates'
import { PrescriptionPreview } from '../PrescriptionPreview'

const DEFAULT_COLOR = '#0d9488'

const defaultsFor = (layout: PrescriptionTemplate | null) => ({
  name: layout?.name ?? '',
  pageSize: layout?.pageSize ?? PageSize.A4,
  isDefault: layout?.isDefault ?? false,
  primaryColor:
    (layout?.styling.primaryColor as string | undefined) ?? DEFAULT_COLOR,
  showVitals: layout?.styling.showVitals !== false,
  showMedicineUrdu: layout?.styling.showMedicineUrdu !== false,
  showPatientGender: layout?.styling.showPatientGender !== false,
  showDate: layout?.styling.showDate !== false,
  clinicName: (layout?.header.clinicName as string | undefined) ?? '',
  clinicNameUrdu: (layout?.header.clinicNameUrdu as string | undefined) ?? '',
  doctorQualification:
    (layout?.header.doctorQualification as string | undefined) ?? '',
  registrationNumber:
    (layout?.header.registrationNumber as string | undefined) ?? '',
  doctorPhone: (layout?.header.doctorPhone as string | undefined) ?? '',
  address: (layout?.footer.address as string | undefined) ?? '',
  timings: (layout?.footer.timings as string | undefined) ?? '',
  phone: (layout?.footer.phone as string | undefined) ?? '',
  disclaimerText: (layout?.footer.disclaimerText as string | undefined) ?? '',
})

type Values = ReturnType<typeof defaultsFor>

/** The settings in the form, laid out the way the printed template stores them. */
function toParts(v: Values, layout: PrescriptionTemplate | null) {
  return {
    header: {
      ...layout?.header,
      clinicName: v.clinicName,
      clinicNameUrdu: v.clinicNameUrdu,
      doctorQualification: v.doctorQualification,
      registrationNumber: v.registrationNumber,
      doctorPhone: v.doctorPhone,
    },
    footer: {
      ...layout?.footer,
      address: v.address,
      timings: v.timings,
      phone: v.phone,
      disclaimerText: v.disclaimerText,
    },
    styling: {
      ...layout?.styling,
      primaryColor: v.primaryColor,
      showVitals: v.showVitals,
      showMedicineUrdu: v.showMedicineUrdu,
      showPatientGender: v.showPatientGender,
      showDate: v.showDate,
    },
  }
}

/** Create or edit a print layout, with the printed page shown live beside it. */
export function LayoutSheet({
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
  const pending = create.isPending || update.isPending

  const form = useForm({
    defaultValues: defaultsFor(layout),
    onSubmit: async ({ value }) => {
      const payload = {
        name: value.name.trim(),
        pageSize: value.pageSize,
        isDefault: value.isDefault,
        ...toParts(value, layout),
      }
      if (layout) await update.mutateAsync({ id: layout.id, data: payload })
      else await create.mutateAsync(payload)
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(layout))
  }, [open, layout])

  const values = useStore(form.store, (s) => s.values)
  const parts = toParts(values, layout)
  const previewTemplate: PrescriptionTemplate = {
    id: 'preview',
    organizationId: '',
    locationId: null,
    name: values.name,
    isDefault: values.isDefault,
    pageSize: values.pageSize,
    orientation: PageOrientation.PORTRAIT,
    customWidthMm: null,
    customHeightMm: null,
    ...parts,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={layout ? 'Edit print layout' : 'New print layout'}
      description="How a printed prescription looks: letterhead, footer and what to show. The page on the right updates as you type."
      widthClassName="sm:max-w-6xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                form="layout-form"
                disabled={!canSubmit || isSubmitting || pending}
              >
                {(isSubmitting || pending) && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {layout ? 'Save changes' : 'Create layout'}
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          id="layout-form"
          className="space-y-7"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FormSection title="Layout">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) =>
                  value.trim() ? undefined : 'Name is required',
              }}
            >
              {(field) => (
                <FormInput
                  label="Name"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]}
                  placeholder="e.g. Main branch letterhead"
                />
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="pageSize">
                {(field) => (
                  <FormSelect
                    label="Paper size"
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as PageSize)}
                    options={[
                      { value: PageSize.A4, label: 'A4' },
                      { value: PageSize.A5, label: 'A5' },
                      { value: PageSize.LETTER, label: 'Letter' },
                    ]}
                  />
                )}
              </form.Field>
              <form.Field name="primaryColor">
                {(field) => (
                  <FieldWrapper label="Accent colour" htmlFor="layout-color">
                    <input
                      id="layout-color"
                      type="color"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="h-9 w-full cursor-pointer rounded-md border border-border bg-surface p-1"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            </div>
            <form.Field name="isDefault">
              {(field) => (
                <ToggleRow
                  label="Use as the default layout"
                  hint="New prescriptions print with this unless another is chosen."
                  checked={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
          </FormSection>

          <FormSection title="Letterhead (top of the page)">
            <form.Field name="clinicName">
              {(field) => (
                <FormInput
                  label="Clinic name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Smile Dental Clinic"
                />
              )}
            </form.Field>
            <form.Field name="clinicNameUrdu">
              {(field) => (
                <FormInput
                  label="Clinic name in Urdu"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  dir="rtl"
                  className="text-right"
                />
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="doctorQualification">
                {(field) => (
                  <FormInput
                    label="Qualification"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="BDS, FCPS"
                  />
                )}
              </form.Field>
              <form.Field name="registrationNumber">
                {(field) => (
                  <FormInput
                    label="Registration no."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="PMDC #"
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="doctorPhone">
              {(field) => (
                <FormInput
                  label="Doctor phone"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>
          </FormSection>

          <FormSection title="Footer (bottom of the page)">
            <form.Field name="address">
              {(field) => (
                <FormTextarea
                  label="Address"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-16 resize-none"
                />
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="timings">
                {(field) => (
                  <FormInput
                    label="Timings"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Mon–Sat 9 AM – 9 PM"
                  />
                )}
              </form.Field>
              <form.Field name="phone">
                {(field) => (
                  <FormInput
                    label="Clinic phone"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="disclaimerText">
              {(field) => (
                <FormInput
                  label="Small print (optional)"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            </form.Field>
          </FormSection>

          <FormSection title="Show on the prescription">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <form.Field name="showVitals">
                {(field) => (
                  <ToggleRow
                    label="Vitals"
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
              <form.Field name="showMedicineUrdu">
                {(field) => (
                  <ToggleRow
                    label="Medicine names in Urdu"
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
              <form.Field name="showPatientGender">
                {(field) => (
                  <ToggleRow
                    label="Patient gender"
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
              <form.Field name="showDate">
                {(field) => (
                  <ToggleRow
                    label="Date"
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>
            </div>
          </FormSection>
        </form>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-text-3">
            Live preview
          </p>
          <div className="max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-panel p-3">
            <PrescriptionPreview
              template={previewTemplate}
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
                    mealRelation: MealRelation.AFTER_MEAL,
                  },
                ],
                instructionsEnglish: 'Drink plenty of water. Rest as needed.',
                instructionsUrdu: 'وافر مقدار میں پانی پیئیں۔',
                createdAt: new Date().toISOString(),
              }}
            />
          </div>
        </div>
      </div>
    </FormSheet>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {hint && <p className="text-xs text-text-3">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
