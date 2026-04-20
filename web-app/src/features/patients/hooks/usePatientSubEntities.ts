import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/patients.api';

// ─── Query Keys ─────────────────────────────────────────────────────

export const keys = {
  all: (patientId: string) => ['patient', patientId] as const,
  dentalInfo: (patientId: string) => [...keys.all(patientId), 'dental-info'] as const,
  vitals: (patientId: string) => [...keys.all(patientId), 'vitals'] as const,
  teethCharts: (patientId: string) => [...keys.all(patientId), 'teeth-charts'] as const,
  treatmentPlans: (patientId: string) => [...keys.all(patientId), 'treatment-plans'] as const,
  prescriptions: (patientId: string) => [...keys.all(patientId), 'prescriptions'] as const,
  consents: (patientId: string) => [...keys.all(patientId), 'consents'] as const,
  communications: (patientId: string) => [...keys.all(patientId), 'communications'] as const,
  recalls: (patientId: string) => [...keys.all(patientId), 'recalls'] as const,
  documents: (patientId: string) => [...keys.all(patientId), 'documents'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────

export function useDentalInfo(patientId: string) {
  return useQuery({
    queryKey: keys.dentalInfo(patientId),
    queryFn: () => api.fetchPatientDentalInfo(patientId),
    enabled: !!patientId,
  });
}

export function useVitals(patientId: string) {
  return useQuery({
    queryKey: keys.vitals(patientId),
    queryFn: () => api.fetchPatientVitals(patientId),
    enabled: !!patientId,
  });
}

export function useTeethCharts(patientId: string) {
  return useQuery({
    queryKey: keys.teethCharts(patientId),
    queryFn: () => api.fetchPatientTeethCharts(patientId),
    enabled: !!patientId,
  });
}

export function useTreatmentPlans(patientId: string) {
  return useQuery({
    queryKey: keys.treatmentPlans(patientId),
    queryFn: () => api.fetchPatientTreatmentPlans(patientId),
    enabled: !!patientId,
  });
}

export function usePrescriptions(patientId: string) {
  return useQuery({
    queryKey: keys.prescriptions(patientId),
    queryFn: () => api.fetchPatientPrescriptions(patientId),
    enabled: !!patientId,
  });
}

export function useConsents(patientId: string) {
  return useQuery({
    queryKey: keys.consents(patientId),
    queryFn: () => api.fetchPatientConsents(patientId),
    enabled: !!patientId,
  });
}

export function useCommunications(patientId: string) {
  return useQuery({
    queryKey: keys.communications(patientId),
    queryFn: () => api.fetchPatientCommunications(patientId),
    enabled: !!patientId,
  });
}

export function useRecalls(patientId: string) {
  return useQuery({
    queryKey: keys.recalls(patientId),
    queryFn: () => api.fetchPatientRecalls(patientId),
    enabled: !!patientId,
  });
}

export function useDocuments(patientId: string) {
  return useQuery({
    queryKey: keys.documents(patientId),
    queryFn: () => api.fetchPatientDocuments(patientId),
    enabled: !!patientId,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────

export function useUpsertDentalInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) => 
      api.upsertPatientDentalInfo(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.dentalInfo(patientId) });
    },
  });
}

export function useCreateVitals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) => 
      api.createPatientVitals(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.vitals(patientId) });
    },
  });
}

export function useCreateTeethChart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...payload }: { patientId: string } & any) => 
      api.createPatientTeethChart(patientId, payload),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: keys.teethCharts(patientId) });
    },
  });
}

// Add other mutations here as required...
