import { useState, useEffect, useRef } from 'react'
import { useForm } from '@tanstack/react-form'
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
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { usePatientStore } from '@/store/patient-store'
import {
  GENDER_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  SOURCE_OPTIONS,
  FORM_STEPS,
  CommunicationPreference,
  Language,
  PatientSource,
  type PatientFormData,
  type Patient,
} from '../types'
import { cn } from '@/lib/utils'

interface PatientFormProps {
  defaultValues?: Patient | null
  onSubmit: (data: PatientFormData) => Promise<void>
  isSubmitting: boolean
  mode: 'create' | 'edit'
  onCancel?: () => void
}

const EMPTY_FORM: PatientFormData = {
  fullName: '',
  phone: '',
  whatsappNumber: '',
  dob: '',
  gender: undefined,
  bloodGroup: undefined,
  maritalStatus: undefined,
  cnic: '',
  email: '',
  city: '',
  address: '',
  preferredLanguage: Language.URDU,
  communicationPref: CommunicationPreference.WHATSAPP,
  source: PatientSource.WALK_IN,
  referredByText: '',
  occupation: '',
  internalNotes: '',
  tags: [],
  isMinor: false,
  guardianName: '',
  guardianPhone: '',
  guardianRelation: '',
  medicalHistory: '',
  allergies: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
}

export function PatientForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
  onCancel,
}: PatientFormProps) {
  const {
    currentStep,
    setCurrentStep,
    formDraft,
    setFormDraft,
    clearFormDraft,
  } = usePatientStore()

  const isSubmittingRef = useRef(false)
  const formValuesRef = useRef<PatientFormData | null>(null)

  const initialValues: PatientFormData = defaultValues
    ? mapPatientToForm(defaultValues)
    : formDraft
      ? { ...EMPTY_FORM, ...formDraft }
      : { ...EMPTY_FORM }

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      isSubmittingRef.current = true
      try {
        await onSubmit(value)
        if (mode === 'create') {
          clearFormDraft()
        }
      } finally {
        isSubmittingRef.current = false
      }
    },
  })

  // Keep a ref to current form values so step-change draft saves don't depend
  // on render timing. Draft is persisted only on explicit navigation (goNext /
  // step buttons), never on a timer — so it never feels like the record is
  // being saved while the user is still typing.
  useEffect(() => {
    formValuesRef.current = form.state.values
  })

  useEffect(() => {
    if (mode === 'edit') {
      setCurrentStep(0)
    }
  }, [mode, setCurrentStep])

  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({})

  const isFutureDate = (d?: string) => !!d && new Date(d) > new Date()
  const phoneOk = (p?: string) => !p || /^[0-9+\-\s()]{7,20}$/.test(p.trim())
  const emailOk = (e?: string) =>
    !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
  const cnicOk = (c?: string) => !c || /^\d{5}-\d{7}-\d$/.test(c.trim())

  // Validate a specific step's fields. Returns the list of errors.
  const errorsForStep = (step: number): string[] => {
    const v = form.state.values
    const errors: string[] = []

    if (step === 0) {
      if (!v.fullName?.trim()) errors.push('Full Name is required')
      if (!v.phone?.trim()) errors.push('Phone Number is required')
      else if (!phoneOk(v.phone))
        errors.push('Phone Number looks invalid (7–20 digits)')
      if (!phoneOk(v.whatsappNumber)) errors.push('WhatsApp Number looks invalid')
      if (!emailOk(v.email)) errors.push('Email address is invalid')
      if (!cnicOk(v.cnic)) errors.push('CNIC must look like 42101-1234567-1')
      if (isFutureDate(v.dob)) errors.push('Date of Birth cannot be in the future')
    }

    if (step === 2 && v.isMinor) {
      if (!v.guardianName?.trim())
        errors.push('Guardian Name is required for minor patients')
      if (!phoneOk(v.guardianPhone)) errors.push('Guardian Phone looks invalid')
    }

    if (step === 3) {
      if (!phoneOk(v.emergencyContactPhone))
        errors.push('Emergency Contact Phone looks invalid')
    }

    return errors
  }

  const validateCurrentStep = (): boolean => {
    const errors = errorsForStep(currentStep)
    setStepErrors((prev) => ({ ...prev, [currentStep]: errors }))
    return errors.length === 0
  }

  // Validate every step before the final submit; jump to the first bad step.
  const validateAll = (): boolean => {
    for (let s = 0; s < FORM_STEPS.length; s++) {
      const errors = errorsForStep(s)
      if (errors.length > 0) {
        setStepErrors((prev) => ({ ...prev, [s]: errors }))
        setCurrentStep(s)
        return false
      }
    }
    return true
  }

  const handleFinalSubmit = () => {
    if (!validateAll()) return
    form.handleSubmit()
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    if (currentStep < FORM_STEPS.length - 1) {
      if (mode === 'create' && formValuesRef.current) {
        setFormDraft(formValuesRef.current)
      }
      setCurrentStep(currentStep + 1)
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setStepErrors((prev) => ({ ...prev, [currentStep]: [] }))
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCancel = () => {
    if (mode === 'create') {
      clearFormDraft()
    } else {
      setCurrentStep(0)
    }
    onCancel?.()
  }

  const currentErrors = stepErrors[currentStep] || []

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {FORM_STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (i < currentStep || validateCurrentStep()) {
                  if (mode === 'create' && formValuesRef.current) {
                    setFormDraft(formValuesRef.current)
                  }
                  setCurrentStep(i)
                }
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                i === currentStep
                  ? 'bg-brand-600 text-white shadow-sm'
                  : i < currentStep
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  i === currentStep
                    ? 'bg-white/20 text-white'
                    : i < currentStep
                      ? 'bg-brand-600 text-white'
                      : 'bg-muted-foreground/20 text-muted-foreground',
                )}
              >
                {i < currentStep ? <Check size={12} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{step.title}</span>
            </button>
            {i < FORM_STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 h-px transition-colors duration-300',
                  i < currentStep ? 'bg-brand-400' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Validation Errors */}
      {currentErrors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          {currentErrors.map((err) => (
            <p key={err} className="text-sm text-destructive">{err}</p>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          // Never submit implicitly (e.g. pressing Enter in a field). The
          // record is created only via the explicit "Save Patient" button.
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <Card className="border-muted shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="text-xl text-primary">
              {FORM_STEPS[currentStep].title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {FORM_STEPS[currentStep].description}
            </p>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Step 0: Basic & Contact Info */}
            {currentStep === 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <form.Field name="fullName">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName">
                          Full Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="fullName"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="John Doe"
                        />
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
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="phone">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">
                          Phone Number{' '}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="phone"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="03001234567"
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="whatsappNumber">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                        <Input
                          id="whatsappNumber"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="03001234567"
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="dob">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
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
                            field.handleChange(v as PatientFormData['gender'])
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
                              v as PatientFormData['bloodGroup'],
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
                              v as PatientFormData['maritalStatus'],
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
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
                        />
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
                        />
                      </div>
                    )}
                  </form.Field>
                </div>

                <form.Field name="address">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Full residential address"
                        rows={2}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            )}

            {/* Step 1: Clinic Info */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <form.Field name="source">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="source">
                          How did they hear about us?
                        </Label>
                        <Select
                          value={field.state.value || ''}
                          onValueChange={(v) =>
                            field.handleChange(v as PatientFormData['source'])
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
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="referredByText">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="referredByText">
                          Referral Notes (Name/Doctor)
                        </Label>
                        <Input
                          id="referredByText"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Dr. Ahmed / Friend"
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="preferredLanguage">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label>Preferred Language</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="preferredLanguage"
                              checked={field.state.value === Language.URDU}
                              onChange={() => field.handleChange(Language.URDU)}
                            />{' '}
                            Urdu
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name="preferredLanguage"
                              checked={field.state.value === Language.ENGLISH}
                              onChange={() =>
                                field.handleChange(Language.ENGLISH)
                              }
                            />{' '}
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
                          value={field.state.value || ''}
                          onValueChange={(v) =>
                            field.handleChange(v as CommunicationPreference)
                          }
                        >
                          <SelectTrigger id="communicationPref">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value={CommunicationPreference.WHATSAPP}
                            >
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
                        />
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
                      <Label htmlFor="internalNotes">
                        Internal Clinic Notes
                      </Label>
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

            {/* Step 2: Guardian Info */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <form.Field name="isMinor">
                  {(field) => (
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/10">
                      <div className="space-y-0.5">
                        <Label className="text-base">Is Patient a Minor?</Label>
                        <p className="text-sm text-muted-foreground text-pretty">
                          Enable this if the patient is underage and requires a
                          guardian's consent.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={field.state.value}
                            onChange={(e) =>
                              field.handleChange(e.target.checked)
                            }
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                        </label>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Subscribe selector={(state) => state.values.isMinor}>
                  {(isMinor) =>
                    isMinor && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 border rounded-lg bg-orange-50/30 border-brand-100">
                        <form.Field name="guardianName">
                          {(field) => (
                            <div className="space-y-1.5 md:col-span-2">
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
                              />
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
                              />
                            </div>
                          )}
                        </form.Field>
                        <form.Field name="guardianRelation">
                          {(field) => (
                            <div className="space-y-1.5">
                              <Label htmlFor="guardianRelation">
                                Relation to Patient
                              </Label>
                              <Input
                                id="guardianRelation"
                                value={field.state.value}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                placeholder="Father, Mother, etc."
                              />
                            </div>
                          )}
                        </form.Field>
                      </div>
                    )
                  }
                </form.Subscribe>
              </div>
            )}

            {/* Step 3: Emergency & Medical History */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <form.Field name="medicalHistory">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="medicalHistory">
                        General Medical History
                      </Label>
                      <Textarea
                        id="medicalHistory"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Previous surgeries, chronic conditions, ongoing treatments..."
                        rows={4}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="allergies">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="allergies">Known Allergies</Label>
                      <Input
                        id="allergies"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Penicillin, Peanuts, Latex... (Comma separated)"
                      />
                    </div>
                  )}
                </form.Field>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-4 text-primary">
                    Emergency Contact
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <form.Field name="emergencyContactName">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="emergencyContactName">
                            Contact Name
                          </Label>
                          <Input
                            id="emergencyContactName"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Emergency contact name"
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="emergencyContactPhone">
                      {(field) => (
                        <div className="space-y-1.5">
                          <Label htmlFor="emergencyContactPhone">
                            Contact Phone
                          </Label>
                          <Input
                            id="emergencyContactPhone"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="03001234567"
                          />
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="emergencyContactRelation">
                      {(field) => (
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="emergencyContactRelation">
                            Relationship
                          </Label>
                          <Select
                            value={field.state.value || ''}
                            onValueChange={(v) => field.handleChange(v)}
                          >
                            <SelectTrigger id="emergencyContactRelation">
                              <SelectValue placeholder="Select relationship" />
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
                        </div>
                      )}
                    </form.Field>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 0 ? handleCancel : goPrev}
            className="w-28"
          >
            {currentStep === 0 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft size={16} className="mr-1" /> Back
              </>
            )}
          </Button>

          {currentStep < FORM_STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} className="w-28">
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="min-w-32"
            >
              {isSubmitting && (
                <Loader2 size={16} className="mr-2 animate-spin" />
              )}
              {mode === 'create' ? 'Save Patient' : 'Update Details'}
            </Button>
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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const input = e.currentTarget
      const trimmed = input.value.trim().replace(/,/g, '')
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed])
      }
      input.value = ''
    }
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        placeholder="Type and press Enter to add tag..."
        onKeyDown={handleKeyDown}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer bg-brand-100 text-brand-700 hover:bg-brand-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 hover:text-destructive transition-colors focus:outline-none"
                aria-label={`Remove ${tag}`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────

function mapPatientToForm(patient: Patient): PatientFormData {
  return {
    fullName: patient.fullName,
    phone: patient.phone,
    whatsappNumber: patient.whatsappNumber || '',
    dob: patient.dob || '',
    gender: patient.gender || undefined,
    bloodGroup: patient.bloodGroup || undefined,
    maritalStatus: patient.maritalStatus || undefined,
    cnic: patient.cnic || '',
    email: patient.email || '',
    city: patient.city || '',
    address: patient.address || '',
    preferredLanguage: patient.preferredLanguage || Language.URDU,
    communicationPref:
      patient.communicationPref || CommunicationPreference.WHATSAPP,
    source: patient.source || PatientSource.WALK_IN,
    referredByText: patient.referredByText || '',
    occupation: patient.occupation || '',
    internalNotes: patient.internalNotes || '',
    tags: patient.tags || [],
    isMinor: patient.isMinor || false,
    guardianName: patient.guardianName || '',
    guardianPhone: patient.guardianPhone || '',
    guardianRelation: patient.guardianRelation || '',
    medicalHistory: patient.medicalHistory || '',
    allergies: patient.allergies || '',
    emergencyContactName: patient.emergencyContactName || '',
    emergencyContactPhone: patient.emergencyContactPhone || '',
    emergencyContactRelation: patient.emergencyContactRelation || '',
  }
}
