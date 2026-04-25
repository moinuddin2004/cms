import { useMutation } from '@tanstack/react-query'
import { validateAppointment } from '../services/appointments.api'

export function useValidateAppointment() {
  return useMutation({
    mutationFn: validateAppointment,
  })
}
