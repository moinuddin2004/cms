import { useQuery } from '@tanstack/react-query'
import { fetchPrescriptionHistory } from '../services/prescriptions.api'

export const PRESCRIPTION_HISTORY_KEY = 'prescription-history'

export function usePrescriptionHistory(prescriptionId: string | undefined) {
  return useQuery({
    queryKey: [PRESCRIPTION_HISTORY_KEY, prescriptionId],
    queryFn: () => fetchPrescriptionHistory(prescriptionId!),
    enabled: !!prescriptionId,
  })
}
