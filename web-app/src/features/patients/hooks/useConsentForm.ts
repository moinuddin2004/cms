import type { RefObject } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import type { SignaturePadHandle } from '@/components/shared/SignaturePad'
import { ConsentType } from '../types'
import { consentSchema } from '../schemas/patient-records.schema'
import type { ConsentFormValues } from '../schemas/patient-records.schema'
import { useCreateConsent } from './usePatientSubEntities'

/** Capture a signed consent. The signature itself lives on the pad (ref). */
export function useConsentForm({
  patientId,
  isMinor,
  sigRef,
  onSaved,
}: {
  patientId: string
  isMinor?: boolean
  sigRef: RefObject<SignaturePadHandle | null>
  onSaved: () => void
}) {
  const { mutate, isPending } = useCreateConsent()
  const { user } = useAuthStore()

  const defaultValues: ConsentFormValues = {
    consentType: ConsentType.GENERAL,
    consentText: 'I hereby give my consent for general dental procedures.',
    isAgreed: false,
    signedByName: '',
    signedByType: isMinor ? 'GUARDIAN' : 'PATIENT',
  }

  const form = useForm({
    defaultValues,
    validators: { onChange: consentSchema, onSubmit: consentSchema },
    onSubmit: async ({ value }) => {
      // The pad is a canvas, not a form field — checked here.
      if (sigRef.current?.isEmpty()) {
        toast.error('Please capture a signature before saving.')
        return
      }

      // Store the signature inline as a PNG data URL. signatureUrl is a TEXT
      // column rendered directly as an <img src>, so no external file storage
      // is needed for signatures.
      const signatureUrl = sigRef.current?.toDataURL() ?? undefined

      mutate(
        {
          patientId,
          consentType: value.consentType,
          consentText: value.consentText,
          isAgreed: value.isAgreed,
          signedByName: value.signedByName.trim(),
          signedByType: value.signedByType,
          witnessedBy: user?.uuid,
          signatureUrl,
        },
        {
          onSuccess: () => {
            form.reset()
            sigRef.current?.clear()
            onSaved()
          },
        },
      )
    },
  })

  return { form, isPending }
}
