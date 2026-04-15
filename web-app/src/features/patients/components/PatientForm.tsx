import { useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { usePatientStore } from '@/store/patient-store';
import {
  GENDER_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  FORM_STEPS,
  type PatientFormData,
  type Patient,
} from '../types';
import { cn } from '@/lib/utils';

interface PatientFormProps {
  defaultValues?: Patient | null;
  onSubmit: (data: PatientFormData) => Promise<void>;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

const EMPTY_FORM: PatientFormData = {
  fullName: '',
  phone: '',
  dob: '',
  gender: undefined,
  bloodGroup: undefined,
  email: '',
  address: '',
  city: '',
  referredBy: '',
  occupation: '',
  medicalHistory: '',
  allergies: [],
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
};

export function PatientForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: PatientFormProps) {
  const navigate = useNavigate();
  const { currentStep, setCurrentStep, formDraft, setFormDraft, clearFormDraft } =
    usePatientStore();

  // Build initial values from: default (edit) → draft (create auto-save) → empty
  const initialValues: PatientFormData = defaultValues
    ? mapPatientToForm(defaultValues)
    : formDraft
      ? { ...EMPTY_FORM, ...formDraft }
      : { ...EMPTY_FORM };

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
      clearFormDraft();
    },
  });

  // Auto-save draft to Zustand (only in create mode)
  const saveDraft = useCallback(() => {
    if (mode === 'create') {
      const values = form.state.values;
      setFormDraft(values);
    }
  }, [mode, form, setFormDraft]);

  useEffect(() => {
    const interval = setInterval(saveDraft, 3000);
    return () => clearInterval(interval);
  }, [saveDraft]);

  const goNext = () => {
    if (currentStep < FORM_STEPS.length - 1) {
      saveDraft();
      setCurrentStep(currentStep + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    clearFormDraft();
    navigate({ to: '/patients' });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {FORM_STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                saveDraft();
                setCurrentStep(i);
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                i === currentStep
                  ? 'bg-brand-600 text-white shadow-sm'
                  : i < currentStep
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
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
                  'w-8 h-px',
                  i < currentStep ? 'bg-brand-400' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (currentStep === FORM_STEPS.length - 1) {
            form.handleSubmit();
          }
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {FORM_STEPS[currentStep].title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {FORM_STEPS[currentStep].description}
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Step 0: Basic Info */}
            {currentStep === 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        {field.state.meta.errors?.length > 0 && (
                          <p className="text-xs text-destructive">{field.state.meta.errors[0]}</p>
                        )}
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
                          onBlur={field.handleBlur}
                          placeholder="+92 300 1234567"
                        />
                        {field.state.meta.errors?.length > 0 && (
                          <p className="text-xs text-destructive">{field.state.meta.errors[0]}</p>
                        )}
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          onValueChange={(v) => field.handleChange(v as PatientFormData['gender'])}
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
                          onValueChange={(v) => field.handleChange(v as PatientFormData['bloodGroup'])}
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="Full address"
                        rows={2}
                      />
                    </div>
                  )}
                </form.Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <form.Field name="referredBy">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="referredBy">Referred By</Label>
                        <Input
                          id="referredBy"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Dr. Name / Friend"
                        />
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
              </>
            )}

            {/* Step 1: Medical Info */}
            {currentStep === 1 && (
              <>
                <form.Field name="medicalHistory">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="medicalHistory">Medical History</Label>
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
                    <AllergyInput
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
              </>
            )}

            {/* Step 2: Emergency Contact */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field name="emergencyName">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="emergencyName">Contact Name</Label>
                      <Input
                        id="emergencyName"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Emergency contact name"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="emergencyPhone">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="emergencyPhone">Contact Phone</Label>
                      <Input
                        id="emergencyPhone"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="+92 300 1234567"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="emergencyRelation">
                  {(field) => (
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="emergencyRelation">Relationship</Label>
                      <Select
                        value={field.state.value || ''}
                        onValueChange={(v) => field.handleChange(v)}
                      >
                        <SelectTrigger id="emergencyRelation">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'].map(
                            (rel) => (
                              <SelectItem key={rel} value={rel}>
                                {rel}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
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
            <Button type="button" onClick={goNext}>
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
              {mode === 'create' ? 'Create Patient' : 'Save Changes'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Allergy Tag Input ──────────────────────────────────────────────

function AllergyInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (val: string[]) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const input = e.currentTarget;
      const trimmed = input.value.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      input.value = '';
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="allergies">Allergies</Label>
      <Input
        id="allergies"
        placeholder="Type and press Enter to add..."
        onKeyDown={handleKeyDown}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((allergy) => (
            <Badge
              key={allergy}
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer"
            >
              {allergy}
              <button
                type="button"
                onClick={() => removeTag(allergy)}
                className="ml-0.5 hover:text-destructive transition-colors"
                aria-label={`Remove ${allergy}`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function mapPatientToForm(patient: Patient): PatientFormData {
  return {
    fullName: patient.fullName,
    phone: patient.phone,
    dob: patient.dob || '',
    gender: patient.gender as PatientFormData['gender'],
    bloodGroup: patient.bloodGroup as PatientFormData['bloodGroup'],
    email: patient.email || '',
    address: patient.address || '',
    city: patient.city || '',
    referredBy: patient.referredBy || '',
    occupation: patient.occupation || '',
    medicalHistory: patient.medicalHistory || '',
    allergies: patient.allergies || [],
    emergencyName: patient.emergencyName || '',
    emergencyPhone: patient.emergencyPhone || '',
    emergencyRelation: patient.emergencyRelation || '',
  };
}
