import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  addPrescriptionMedicine,
  removePrescriptionMedicine,
  updatePrescriptionMedicine,
} from '../services/prescriptions.api'
import { PRESCRIPTION_KEY, PRESCRIPTIONS_KEY } from './usePrescriptions'
import type { PrescriptionMedicine } from '../types'

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.message || fallback
}

export function useAddPrescriptionMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      prescriptionId,
      data,
    }: {
      prescriptionId: string
      data: PrescriptionMedicine
    }) => addPrescriptionMedicine(prescriptionId, data),
    onSuccess: (_, { prescriptionId }) => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_KEY, prescriptionId] })
      qc.invalidateQueries({ queryKey: [PRESCRIPTIONS_KEY] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to add medicine')),
  })
}

export function useUpdatePrescriptionMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      prescriptionId,
      medicineId,
      data,
    }: {
      prescriptionId: string
      medicineId: string
      data: PrescriptionMedicine
    }) => updatePrescriptionMedicine(prescriptionId, medicineId, data),
    onSuccess: (_, { prescriptionId }) => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_KEY, prescriptionId] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to update medicine')),
  })
}

export function useRemovePrescriptionMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      prescriptionId,
      medicineId,
    }: {
      prescriptionId: string
      medicineId: string
    }) => removePrescriptionMedicine(prescriptionId, medicineId),
    onSuccess: (_, { prescriptionId }) => {
      qc.invalidateQueries({ queryKey: [PRESCRIPTION_KEY, prescriptionId] })
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to remove medicine')),
  })
}
