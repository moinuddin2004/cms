import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPrescription,
  duplicatePrescription,
  fetchPrescription,
  fetchPrescriptions,
  fetchPrescriptionStats,
  fetchPrescriptionsByAppointment,
  fetchPrescriptionsByPatient,
  finalizePrescription,
  updatePrescription,
} from '../services/prescriptions.api'
import type {
  CreatePrescriptionInput,
  FinalizePrescriptionInput,
  PrescriptionFilterParams,
  UpdatePrescriptionInput,
} from '../types'

export const PRESCRIPTIONS_KEY = 'prescriptions'
export const PRESCRIPTION_KEY = 'prescription'
export const PRESCRIPTION_STATS_KEY = 'prescription-stats'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

export function usePrescriptions(filters: PrescriptionFilterParams) {
  return useQuery({
    queryKey: [PRESCRIPTIONS_KEY, filters],
    queryFn: () => fetchPrescriptions(filters),
    placeholderData: (prev) => prev,
  })
}

export function usePrescription(id: string | undefined) {
  return useQuery({
    queryKey: [PRESCRIPTION_KEY, id],
    queryFn: () => fetchPrescription(id!),
    enabled: !!id,
  })
}

export function usePrescriptionsByPatient(
  patientId: string | undefined,
  page = 1,
  limit = 20,
) {
  return useQuery({
    queryKey: [PRESCRIPTIONS_KEY, 'patient', patientId, page, limit],
    queryFn: () => fetchPrescriptionsByPatient(patientId!, page, limit),
    enabled: !!patientId,
  })
}

export function usePrescriptionsByAppointment(
  appointmentId: string | undefined,
) {
  return useQuery({
    queryKey: [PRESCRIPTIONS_KEY, 'appointment', appointmentId],
    queryFn: () => fetchPrescriptionsByAppointment(appointmentId!),
    enabled: !!appointmentId,
  })
}

export function usePrescriptionStats() {
  return useQuery({
    queryKey: [PRESCRIPTION_STATS_KEY],
    queryFn: () => fetchPrescriptionStats(),
  })
}

export function useCreatePrescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePrescriptionInput) => createPrescription(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTIONS_KEY] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_STATS_KEY] })
      toast.success('Prescription created')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to create prescription')),
  })
}

export function useUpdatePrescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdatePrescriptionInput
    }) => updatePrescription(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_KEY, id] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTIONS_KEY] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to update prescription')),
  })
}

export function useFinalizePrescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: FinalizePrescriptionInput
    }) => finalizePrescription(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_KEY, id] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTIONS_KEY] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_STATS_KEY] })
      toast.success('Prescription finalized')
    },
    onError: (err) =>
      toast.error(errMsg(err, 'Failed to finalize prescription')),
  })
}

export function useDuplicatePrescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => duplicatePrescription(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTIONS_KEY] })
      toast.success('Prescription duplicated as a new draft')
    },
    onError: (err) =>
      toast.error(errMsg(err, 'Failed to duplicate prescription')),
  })
}
