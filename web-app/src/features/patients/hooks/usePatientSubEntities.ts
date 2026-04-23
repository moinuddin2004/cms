import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../services/patients.api'

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

// ─── Mutations ──────────────────────────────────────────────────────

export function useUpsertDentalInfo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.upsertPatientDentalInfo(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.dentalInfo(patientId) })
    },
  })
}

export function useCreateVitals() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientVitals(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.vitals(patientId) })
    },
  })
}

export function useCreateTeethChart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientTeethChart(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.teethCharts(patientId) })
    },
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
    },
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
    },
  })
}

export function useCreatePrescription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientPrescription(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.prescriptions(patientId) })
    },
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientDocument(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.documents(patientId) })
    },
  })
}

export function useCreateConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientConsent(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.consents(patientId) })
    },
  })
}

export function useCreateRecall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientRecall(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.recalls(patientId) })
    },
  })
}

export function useCreateInsurance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) =>
      api.createPatientInsurance(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.insurance(patientId) })
    },
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
    },
  })
}
