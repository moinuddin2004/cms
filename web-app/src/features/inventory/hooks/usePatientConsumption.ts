import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  recordConsumption,
  fetchConsumptionByAppointment,
  fetchConsumptionByPatient,
} from '../services/inventory.api'
import { INVENTORY_ITEMS_KEY, INVENTORY_STATS_KEY } from './useInventory'
import type { RecordConsumptionData } from '../types'

export const CONSUMPTION_KEY = 'patient-consumption'

function getErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message || fallback
}

export function useRecordConsumption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecordConsumptionData) => recordConsumption(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_ITEMS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_STATS_KEY] })
      qc.invalidateQueries({ queryKey: [CONSUMPTION_KEY] })
      toast.success('Consumption recorded')
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'Failed to record consumption')),
  })
}

export function useConsumptionByAppointment(appointmentId: string | undefined) {
  return useQuery({
    queryKey: [CONSUMPTION_KEY, 'appointment', appointmentId],
    queryFn: () => fetchConsumptionByAppointment(appointmentId as string),
    enabled: !!appointmentId,
  })
}

export function useConsumptionByPatient(
  patientId: string | undefined,
  page = 1,
) {
  return useQuery({
    queryKey: [CONSUMPTION_KEY, 'patient', patientId, page],
    queryFn: () => fetchConsumptionByPatient(patientId as string, page),
    enabled: !!patientId,
    placeholderData: keepPreviousData,
  })
}
