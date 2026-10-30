import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { MultiSelect } from '@/components/shared/MultiSelect'
import { Switch } from '@/components/ui/switch'
import { DatePicker } from '@/components/shared/DatePicker'
import { fieldError } from '@/components/forms/fieldError'
import { format } from 'date-fns'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  User,
} from 'lucide-react'
import {
  GENDER_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  SOURCE_OPTIONS,
  FORM_STEPS,
  CommunicationPreference,
  Language,
} from '../types'
import type { PatientFormData, Patient } from '../types'
import { PATIENT_STEP_FIELDS } from '../schemas/patient.schema'
import type { PatientFormValues } from '../schemas/patient.schema'
import { usePatientForm } from '../hooks/usePatientForm'
import { cn } from '@/lib/utils'

interface PatientFormProps {
  defaultValues?: Patient | null
  onSubmit: (data: PatientFormData) => Promise<void>
  isSubmitting: boolean
  mode: 'create' | 'edit'
  onCancel?: () => void
}

export function PatientForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
  onCancel,
}: PatientFormProps) {
  const {
    form,
    currentStep,
    blockedStep,
    goNext,
    goPrev,
    jumpToStep,
    submit,
    cancel,
  } = usePatientForm({ patient: defaultValues, mode, onSubmit, onCancel })

  return (
    <div className="flex flex-col gap-5">
      {/* ── Step Indicator ── */}
      <div className="flex items-center w-full">
        {FORM_STEPS.map((step, i) => (
          <div
            key={step.id}
            className="flex items-center flex-1 last:flex-none"
          >
            <button
              type="button"
              aria-label={step.title}
              onClick={() => void jumpToStep(i)}
              className="flex items-center gap-2 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
            >
              <span
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  i === currentStep
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : i < currentStep
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-background border-border text-muted-foreground',
                )}
              >
                {i < currentStep ? <Check size={11} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm font-medium hidden sm:inline',
                  i === currentStep
                    ? 'text-brand-700'
                    : i < currentStep
                      ? 'text-brand-500'
                      : 'text-slate-400',
                )}
              >
                {step.title}
              </span>
            </button>
            {i < FORM_STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-3 transition-colors duration-300',
                  i < currentStep ? 'bg-brand-400' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Validation Errors ── */}
      <form.Subscribe
        selector={(state) =>
          PATIENT_STEP_FIELDS[currentStep].filter(
            (name) => (state.fieldMeta[name]?.errors.length ?? 0) > 0,
          ).length
        }
      >
        {(invalidCount) =>
          blockedStep === currentStep &&
          invalidCount > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="text-sm text-destructive">
                Fix the {invalidCount} highlighted{' '}
                {invalidCount === 1 ? 'field' : 'fields'} before continuing.
              </p>
            </div>
          )
        }
      </form.Subscribe>

      {/* ── Form ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Step 0: Basic & Contact Info */}
          {currentStep === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-5 space-y-6">
                <div className="flex gap-5">
                  {/* Avatar placeholder */}
                  <div className="flex-shrink-0 pt-1">
                    <div className="w-16 h-16 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
                      <User className="w-7 h-7 text-slate-400" />
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="flex-1 grid grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <p className="col-span-full text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Basic Information
                    </p>

                    <form.Field name="fullName">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="fullName">
                            Full Name{' '}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="fullName"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="John Doe"
                            aria-invalid={!!fieldError(field)}
                          />
                          <FieldErrorText message={fieldError(field)} />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="phone">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="phone">
                            Phone <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="phone"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="03001234567"
                            onBlur={field.handleBlur}
                            aria-invalid={!!fieldError(field)}
                          />
                          <FieldErrorText message={fieldError(field)} />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="whatsappNumber">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="whatsappNumber">WhatsApp</Label>
                          <Input
                            id="whatsappNumber"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="03001234567"
                            onBlur={field.handleBlur}
                            aria-invalid={!!fieldError(field)}
                          />
                          <FieldErrorText message={fieldError(field)} />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="gender">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="gender">Gender</Label>
                          <Select
                            value={field.state.value || ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                (v || undefined) as PatientFormValues['gender'],
                              )
                            }
                          >
                            <SelectTrigger id="gender">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDER_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="bloodGroup">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="bloodGroup">Blood Group</Label>
                          <Select
                            value={field.state.value || ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                (v ||
                                  undefined) as PatientFormValues['bloodGroup'],
                              )
                            }
                          >
                            <SelectTrigger id="bloodGroup">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {BLOOD_GROUP_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="maritalStatus">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="maritalStatus">Marital Status</Label>
                          <Select
                            value={field.state.value || ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                (v ||
                                  undefined) as PatientFormValues['maritalStatus'],
                              )
                            }
                          >
                            <SelectTrigger id="maritalStatus">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {MARITAL_STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="dob">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="dob">Date of Birth</Label>
                          <DatePicker
                            id="dob"
                            value={field.state.value}
                            onChange={field.handleChange}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            placeholder="Select date of birth"
                            withYearDropdown
                            clearable
                          />
                          <FieldErrorText message={fieldError(field)} />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="cnic">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="cnic">CNIC</Label>
                          <Input
                            id="cnic"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="42101-1234567-1"
                            onBlur={field.handleBlur}
                            aria-invalid={!!fieldError(field)}
                          />
                          <FieldErrorText message={fieldError(field)} />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="email">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="patient@email.com"
                            onBlur={field.handleBlur}
                            aria-invalid={!!fieldError(field)}
                          />
                          <FieldErrorText message={fieldError(field)} />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="city">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Karachi"
                            onBlur={field.handleBlur}
                            aria-invalid={!!fieldError(field)}
                          />
                          <FieldErrorText message={fieldError(field)} />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="address">
                      {(field) => (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="address">Address</Label>
                          <Input
                            id="address"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Full residential address"
                          />
                        </div>
                      )}
                    </form.Field>
                  </div>
                </div>

                {/* Guardian + Emergency (side by side) */}
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t pt-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                          Guardian Information
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Turn on if the patient is a minor and needs guardian
                          consent.
                        </p>
                      </div>
                      <form.Field name="isMinor">
                        {(field) => (
                          <div className="flex shrink-0 items-center gap-2">
                            <Label htmlFor="isMinor" className="cursor-pointer">
                              Minor patient
                            </Label>
                            <Switch
                              id="isMinor"
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>

                    <form.Subscribe selector={(state) => state.values.isMinor}>
                      {(isMinor) =>
                        isMinor && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-brand-200/40 bg-brand-500/5 p-4">
                            <form.Field name="guardianName">
                              {(field) => (
                                <div className="space-y-1.5">
                                  <Label htmlFor="guardianName">
                                    Guardian Name{' '}
                                    <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    id="guardianName"
                                    value={field.state.value}
                                    onChange={(e) =>
                                      field.handleChange(e.target.value)
                                    }
                                    placeholder="Guardian full name"
                                    onBlur={field.handleBlur}
                                    aria-invalid={!!fieldError(field)}
                                  />
                                  <FieldErrorText message={fieldError(field)} />
                                </div>
                              )}
                            </form.Field>
                            <form.Field name="guardianPhone">
                              {(field) => (
                                <div className="space-y-1.5">
                                  <Label htmlFor="guardianPhone">
                                    Guardian Phone
                                  </Label>
                                  <Input
                                    id="guardianPhone"
                                    value={field.state.value}
                                    onChange={(e) =>
                                      field.handleChange(e.target.value)
                                    }
                                    placeholder="03001234567"
                                    onBlur={field.handleBlur}
                                    aria-invalid={!!fieldError(field)}
                                  />
                                  <FieldErrorText message={fieldError(field)} />
                                </div>
                              )}
                            </form.Field>
                            <form.Field name="guardianRelation">
                              {(field) => (
                                <div className="space-y-1.5">
                                  <Label htmlFor="guardianRelation">
                                    Relation
                                  </Label>
                                  <Input
                                    id="guardianRelation"
                                    value={field.state.value}
                                    onChange={(e) =>
                                      field.handleChange(e.target.value)
                                    }
                                    placeholder="Father, Mother, etc."
                                    onBlur={field.handleBlur}
                                    aria-invalid={!!fieldError(field)}
                                  />
                                  <FieldErrorText message={fieldError(field)} />
                                </div>
                              )}
                            </form.Field>
                          </div>
                        )
                      }
                    </form.Subscribe>
                  </div>

                  {/* Emergency Contact */}
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Emergency Contact
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <form.Field name="emergencyContactName">
                        {(field) => (
                          <div className="space-y-1.5">
                            <Label htmlFor="emergencyContactName">Name</Label>
                            <Input
                              id="emergencyContactName"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              placeholder="Contact name"
                              onBlur={field.handleBlur}
                              aria-invalid={!!fieldError(field)}
                            />
                            <FieldErrorText message={fieldError(field)} />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="emergencyContactPhone">
                        {(field) => (
                          <div className="space-y-1.5">
                            <Label htmlFor="emergencyContactPhone">Phone</Label>
                            <Input
                              id="emergencyContactPhone"
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              placeholder="03001234567"
                              onBlur={field.handleBlur}
                              aria-invalid={!!fieldError(field)}
                            />
                            <FieldErrorText message={fieldError(field)} />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="emergencyContactRelation">
                        {(field) => (
                          <div className="space-y-1.5">
                            <Label htmlFor="emergencyContactRelation">
                              Relationship
                            </Label>
                            <Select
                              value={field.state.value || ''}
                              onValueChange={(v) => field.handleChange(v)}
                            >
                              <SelectTrigger id="emergencyContactRelation">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {[
                                  'Spouse',
                                  'Parent',
                                  'Sibling',
                                  'Child',
                                  'Friend',
                                  'Other',
                                ].map((rel) => (
                                  <SelectItem key={rel} value={rel}>
                                    {rel}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FieldErrorText message={fieldError(field)} />
                          </div>
                        )}
                      </form.Field>
                    </div>
                  </div>
                </div>

                {/* Medical History */}
                <div className="space-y-4 border-t pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Medical History
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <form.Field name="medicalHistory">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="medicalHistory">
                            Medical History
                          </Label>
                          <Textarea
                            id="medicalHistory"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Previous surgeries, chronic conditions..."
                            rows={3}
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="allergies">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="allergies">Known Allergies</Label>
                          <Textarea
                            id="allergies"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Penicillin, Peanuts... (comma separated)"
                            rows={3}
                          />
                        </div>
                      )}
                    </form.Field>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Clinic Info */}
          {currentStep === 1 && (
            <div className="p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Clinic Information
              </p>

              <div className="grid grid-cols-2 gap-4">
                <form.Field name="source">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="source">
                        How did they hear about us?
                      </Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                          field.handleChange(v as PatientFormValues['source'])
                        }
                      >
                        <SelectTrigger id="source">
                          <SelectValue placeholder="Select Source" />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldErrorText message={fieldError(field)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="referredByText">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="referredByText">Referral Notes</Label>
                      <Input
                        id="referredByText"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Dr. Ahmed / Friend"
                        onBlur={field.handleBlur}
                        aria-invalid={!!fieldError(field)}
                      />
                      <FieldErrorText message={fieldError(field)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="preferredLanguage">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label>Preferred Language</Label>
                      <div className="flex items-center gap-4 h-9">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="preferredLanguage"
                            checked={field.state.value === Language.URDU}
                            onChange={() => field.handleChange(Language.URDU)}
                          />
                          Urdu
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="preferredLanguage"
                            checked={field.state.value === Language.ENGLISH}
                            onChange={() =>
                              field.handleChange(Language.ENGLISH)
                            }
                          />
                          English
                        </label>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="communicationPref">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="communicationPref">
                        Communication Preference
                      </Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                          field.handleChange(v as CommunicationPreference)
                        }
                      >
                        <SelectTrigger id="communicationPref">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CommunicationPreference.WHATSAPP}>
                            WhatsApp
                          </SelectItem>
                          <SelectItem value={CommunicationPreference.SMS}>
                            SMS
                          </SelectItem>
                          <SelectItem value={CommunicationPreference.CALL}>
                            Call
                          </SelectItem>
                          <SelectItem value={CommunicationPreference.EMAIL}>
                            Email
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldErrorText message={fieldError(field)} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="occupation">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="occupation">Occupation</Label>
                      <Input
                        id="occupation"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Software Engineer"
                        onBlur={field.handleBlur}
                        aria-invalid={!!fieldError(field)}
                      />
                      <FieldErrorText message={fieldError(field)} />
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Field name="tags">
                {(field) => (
                  <TagInput
                    value={field.state.value}
                    onChange={field.handleChange}
                    label="Patient Tags (VIP, Anxious, etc.)"
                  />
                )}
              </form.Field>

              <form.Field name="internalNotes">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="internalNotes">Internal Clinic Notes</Label>
                    <Textarea
                      id="internalNotes"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Private notes for staff only..."
                      rows={3}
                    />
                  </div>
                )}
              </form.Field>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between mt-5">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 0 ? cancel : goPrev}
            className="gap-1.5"
          >
            {currentStep === 0 ? (
              <>
                <X size={15} /> Cancel
              </>
            ) : (
              <>
                <ChevronLeft size={15} /> Back
              </>
            )}
          </Button>

          {currentStep < FORM_STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => void goNext()}
              className="gap-1.5"
            >
              Next <ChevronRight size={15} />
            </Button>
          ) : (
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, formSubmitting]) => {
                const busy = isSubmitting || formSubmitting
                return (
                  <Button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!canSubmit || busy}
                    className="gap-1.5"
                  >
                    {busy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {mode === 'create' ? 'Add Patient' : 'Update Details'}
                  </Button>
                )
              }}
            </form.Subscribe>
          )}
        </div>
      </form>
    </div>
  )
}

// ─── Tag Input ──────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  label = 'Tags',
}: {
  value: string[]
  onChange: (val: string[]) => void
  label?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="patient-tags">{label}</Label>
      <MultiSelect
        id="patient-tags"
        creatable
        options={value.map((t) => ({ value: t, label: t }))}
        value={value}
        onChange={onChange}
        placeholder="Add tags…"
        searchPlaceholder="Type a tag and press Enter"
      />
    </div>
  )
}

// ─── Field Error ────────────────────────────────────────────────────

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-danger">{message}</p>
}
