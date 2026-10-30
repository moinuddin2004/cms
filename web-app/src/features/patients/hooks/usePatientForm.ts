import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { usePatientStore } from '@/store/patient-store'
import {
  CommunicationPreference,
  FORM_STEPS,
  Language,
  PatientSource,
} from '../types'
import type { Patient, PatientFormData } from '../types'
import { PATIENT_STEP_FIELDS, patientSchema } from '../schemas/patient.schema'
import type { PatientFormValues } from '../schemas/patient.schema'

const EMPTY_FORM: PatientFormValues = {
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

// Fallbacks kept on typed-required fields: older rows can still hold nulls.
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
function mapPatientToForm(patient: Patient): PatientFormValues {
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
/* eslint-enable @typescript-eslint/no-unnecessary-condition */

/**
 * Multi-step patient create/edit form. `patientSchema` validates the whole
 * form; each step can only be left forward once its own fields are valid.
 * Create mode keeps a draft in the patient store between steps.
 */
export function usePatientForm({
  patient,
  mode,
  onSubmit,
  onCancel,
}: {
  patient?: Patient | null
  mode: 'create' | 'edit'
  onSubmit: (data: PatientFormData) => Promise<void>
  onCancel?: () => void
}) {
  const {
    currentStep,
    setCurrentStep,
    formDraft,
    setFormDraft,
    clearFormDraft,
  } = usePatientStore()

  // Step whose "Next"/submit was refused — shows the "fix the fields" hint.
  const [blockedStep, setBlockedStep] = useState<number | null>(null)

  const initialValues: PatientFormValues = patient
    ? mapPatientToForm(patient)
    : formDraft
      ? { ...EMPTY_FORM, ...formDraft }
      : { ...EMPTY_FORM }

  const form = useForm({
    defaultValues: initialValues,
    validators: { onChange: patientSchema, onSubmit: patientSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
      if (mode === 'create') {
        clearFormDraft()
      }
    },
  })

  useEffect(() => {
    if (mode === 'edit') {
      setCurrentStep(0)
    }
  }, [mode, setCurrentStep])

  /** Runs the schema, then marks the step's failing fields touched so their errors show. */
  const validateStep = async (step: number): Promise<boolean> => {
    await form.validate('change')
    const invalid = PATIENT_STEP_FIELDS[step].filter(
      (name) => (form.getFieldMeta(name)?.errors.length ?? 0) > 0,
    )
    invalid.forEach((name) =>
      form.setFieldMeta(name, (prev) => ({ ...prev, isTouched: true })),
    )
    setBlockedStep(invalid.length > 0 ? step : null)
    return invalid.length === 0
  }

  const goToStep = (step: number) => {
    if (mode === 'create') {
      setFormDraft(form.state.values)
    }
    setCurrentStep(step)
  }

  const goNext = async () => {
    if (currentStep >= FORM_STEPS.length - 1) return
    if (!(await validateStep(currentStep))) return
    goToStep(currentStep + 1)
  }

  /** Step indicator: going back is always allowed, forward only past a valid step. */
  const jumpToStep = async (step: number) => {
    if (step < currentStep || (await validateStep(currentStep))) {
      goToStep(step)
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setBlockedStep(null)
      setCurrentStep(currentStep - 1)
    }
  }

  /** Final submit: land on the first invalid step instead of submitting. */
  const submit = async () => {
    for (let s = 0; s < FORM_STEPS.length; s++) {
      if (!(await validateStep(s))) {
        setCurrentStep(s)
        return
      }
    }
    try {
      await form.handleSubmit()
    } catch {
      // The create/update mutation's onError already showed the toast; the
      // sheet stays open with the user's input so they can fix and resend.
    }
  }

  const cancel = () => {
    if (mode === 'create') {
      clearFormDraft()
    } else {
      setCurrentStep(0)
    }
    onCancel?.()
  }

  return {
    form,
    currentStep,
    blockedStep,
    goNext,
    goPrev,
    jumpToStep,
    submit,
    cancel,
  }
}
