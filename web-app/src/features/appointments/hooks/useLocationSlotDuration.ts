import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchLocationBookingSettings } from '../services/appointments.api'

const FALLBACK_SLOT_MINUTES = 30

/**
 * The active location's default appointment length
 * (location_settings.appointment_slot_duration), used as the booking form's
 * default duration. Falls back to 30 minutes while loading or on error.
 */
export function useLocationSlotDuration(): number {
  const locationId = useAuthStore((s) => s.activeLocationId)
  const { data } = useQuery({
    queryKey: ['location-booking-settings', locationId],
    queryFn: () => fetchLocationBookingSettings(locationId!),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  })
  const minutes = data?.appointmentSlotDuration
  return minutes && minutes >= 5 && minutes <= 480 ? minutes : FALLBACK_SLOT_MINUTES
}
