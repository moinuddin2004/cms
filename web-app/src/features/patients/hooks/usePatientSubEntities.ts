import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '../services/patients.api'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

// ─── Query Keys ─────────────────────────────────────────────────────

export const keys = {
  all: (patientId: string) => ['patient', patientId] as const,
  visits: (patientId: string) => [...keys.all(patientId), 'visits'] as const,
  dentalInfo: (patientId: string) =>
    [...keys.all(patientId), 'dental-info'] as const,
  vitals: (patientId: string) => [...keys.all(patientId), 'vitals'] as const,
  teethCharts: (patientId: string) =>
    [...keys.all(patientId), 'teeth-charts'] as const,
  treatmentPlans: (patientId: string) =>
    [...keys.all(patientId), 'treatment-plans'] as const,
  prescriptions: (patientId: string) =>
    [...keys.all(patientId), 'prescriptions'] as const,
  consents: (patientId: string) =>
    [...keys.all(patientId), 'consents'] as const,
  communications: (patientId: string) =>
    [...keys.all(patientId), 'communications'] as const,
  recalls: (patientId: string) => [...keys.all(patientId), 'recalls'] as const,
  referrals: (patientId: string) =>
    [...keys.all(patientId), 'referrals'] as const,
  feedback: (patientId: string) =>
    [...keys.all(patientId), 'feedback'] as const,
  insurance: (patientId: string) =>
    [...keys.all(patientId), 'insurance'] as const,
  documents: (patientId: string) =>
    [...keys.all(patientId), 'documents'] as const,
  history: (patientId: string) =>
    [...keys.all(patientId), 'history'] as const,
  treatments: (patientId: string) =>
    [...keys.all(patientId), 'treatments'] as const,
  encounter: (encounterId: string) => ['encounter', encounterId] as const,
}

// ─── Queries ────────────────────────────────────────────────────────

export function useVisits(patientId: string) {
  return useQuery({
    queryKey: keys.visits(patientId),
    queryFn: () => api.fetchPatientVisits(patientId),
    enabled: !!patientId,
  })
}

export function useDentalInfo(patientId: string) {
  return useQuery({
    queryKey: keys.dentalInfo(patientId),
    queryFn: () => api.fetchPatientDentalInfo(patientId),
    enabled: !!patientId,
  })
}

export function useVitals(patientId: string) {
  return useQuery({
    queryKey: keys.vitals(patientId),
    queryFn: () => api.fetchPatientVitals(patientId),
    enabled: !!patientId,
  })
}

export function useTeethCharts(patientId: string) {
  return useQuery({
    queryKey: keys.teethCharts(patientId),
    queryFn: () => api.fetchPatientTeethCharts(patientId),
    enabled: !!patientId,
  })
}

export function useTreatmentPlans(patientId: string) {
  return useQuery({
    queryKey: keys.treatmentPlans(patientId),
    queryFn: () => api.fetchPatientTreatmentPlans(patientId),
    enabled: !!patientId,
  })
}

export function usePrescriptions(patientId: string) {
  return useQuery({
    queryKey: keys.prescriptions(patientId),
    queryFn: () => api.fetchPatientPrescriptions(patientId),
    enabled: !!patientId,
  })
}

export function useConsents(patientId: string) {
  return useQuery({
    queryKey: keys.consents(patientId),
    queryFn: () => api.fetchPatientConsents(patientId),
    enabled: !!patientId,
  })
}

export function useCommunications(patientId: string) {
  return useQuery({
    queryKey: keys.communications(patientId),
    queryFn: () => api.fetchPatientCommunications(patientId),
    enabled: !!patientId,
  })
}

export function useRecalls(patientId: string) {
  return useQuery({
    queryKey: keys.recalls(patientId),
    queryFn: () => api.fetchPatientRecalls(patientId),
    enabled: !!patientId,
  })
}

export function useReferrals(patientId: string) {
  return useQuery({
    queryKey: keys.referrals(patientId),
    queryFn: () => api.fetchPatientReferrals(patientId),
    enabled: !!patientId,
  })
}

export function useFeedback(patientId: string) {
  return useQuery({
    queryKey: keys.feedback(patientId),
    queryFn: () => api.fetchPatientFeedback(patientId),
    enabled: !!patientId,
  })
}

export function useInsurance(patientId: string) {
  return useQuery({
    queryKey: keys.insurance(patientId),
    queryFn: () => api.fetchPatientInsurance(patientId),
    enabled: !!patientId,
  })
}

export function useDocuments(patientId: string) {
  return useQuery({
    queryKey: keys.documents(patientId),
    queryFn: () => api.fetchPatientDocuments(patientId),
    enabled: !!patientId,
  })
}

export function usePatientHistory(patientId: string) {
  return useQuery({
    queryKey: keys.history(patientId),
    queryFn: () => api.fetchPatientHistory(patientId),
    enabled: !!patientId,
  })
}

export function usePatientTreatments(patientId: string) {
  return useQuery({
    queryKey: keys.treatments(patientId),
    queryFn: () => api.fetchPatientTreatments(patientId),
    enabled: !!patientId,
  })
}

export function useEncounterDetail(encounterId: string | null) {
  return useQuery({
    queryKey: keys.encounter(encounterId ?? ''),
    queryFn: () => api.fetchEncounterDetail(encounterId as string),
    enabled: !!encounterId,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────

export function useCreateTreatment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createTreatment({ patientId, ...payload }),
    onSuccess: (treatment, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.treatments(patientId) })
      queryClient.invalidateQueries({ queryKey: keys.history(patientId) })
      if (treatment?.encounterId) {
        queryClient.invalidateQueries({
          queryKey: keys.encounter(treatment.encounterId),
        })
      }
      toast.success('Treatment recorded')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to record treatment')),
  })
}

export function useUpsertDentalInfo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.upsertPatientDentalInfo(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.dentalInfo(patientId) })
      toast.success('Dental info saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save dental info')),
  })
}

export function useCreateVitals() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientVitals(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.vitals(patientId) })
      toast.success('Vitals recorded')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to record vitals')),
  })
}

export function useCreateTeethChart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientTeethChart(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.teethCharts(patientId) })
      toast.success('Teeth chart saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save teeth chart')),
  })
}

export function useCreateTreatmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientTreatmentPlan(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: keys.treatmentPlans(patientId),
      })
      toast.success('Treatment plan created')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to create treatment plan')),
  })
}

export function useCreateTreatmentPlanItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      patientId,
      planId,
      ...payload
    }: { patientId: string; planId: string } & any) =>
      api.createPatientTreatmentPlanItem(patientId, planId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: keys.treatmentPlans(patientId),
      })
      toast.success('Procedure added')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to add procedure')),
  })
}

export function useUpdateTreatmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      patientId,
      planId,
      ...payload
    }: { patientId: string; planId: string } & any) =>
      api.updatePatientTreatmentPlan(patientId, planId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: keys.treatmentPlans(patientId),
      })
      toast.success('Treatment plan updated')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to update treatment plan')),
  })
}

export function useUpdateTreatmentPlanItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      patientId,
      planId,
      itemId,
      ...payload
    }: { patientId: string; planId: string; itemId: string } & any) =>
      api.updatePatientTreatmentPlanItem(patientId, planId, itemId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: keys.treatmentPlans(patientId),
      })
      toast.success('Procedure updated')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to update procedure')),
  })
}

export function useCreatePrescription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientPrescription(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.prescriptions(patientId) })
      toast.success('Prescription created')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to create prescription')),
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientDocument(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.documents(patientId) })
      toast.success('Document uploaded')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to upload document')),
  })
}

export function useCreateConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientConsent(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.consents(patientId) })
      toast.success('Consent recorded')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to record consent')),
  })
}

export function useCreateRecall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientRecall(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.recalls(patientId) })
      toast.success('Recall scheduled')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to schedule recall')),
  })
}

export function useCreateInsurance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientInsurance(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.insurance(patientId) })
      toast.success('Insurance added')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to add insurance')),
  })
}

export function useCreateCommunication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientCommunication(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({
        queryKey: keys.communications(patientId),
      })
      toast.success('Communication logged')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to log communication')),
  })
}
