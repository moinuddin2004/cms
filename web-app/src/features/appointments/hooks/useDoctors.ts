import { useQuery } from '@tanstack/react-query'
import { fetchDoctors } from '../services/appointments.api'

export function useDoctors() {
  return useQuery({
    queryKey: ['appointment-doctors'],
    queryFn: fetchDoctors,
  })
}
