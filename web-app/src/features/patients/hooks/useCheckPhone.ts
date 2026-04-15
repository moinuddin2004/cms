import { useQuery } from '@tanstack/react-query';
import { checkPhoneUnique } from '../services/patients.api';

export function useCheckPhone(phone: string, excludeId?: string) {
  return useQuery({
    queryKey: ['check-phone', phone, excludeId],
    queryFn: () => checkPhoneUnique(phone, excludeId),
    enabled: phone.length >= 7, // Only check when phone has enough digits
    staleTime: 10_000, // 10 seconds
  });
}
