import { useQuery } from '@tanstack/react-query';

import { checkPatientPhone } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { isValidPhone } from '../schemas/quick-register.schema';
import { usePatientTenant } from './usePatientTenant';

/**
 * Does a patient with this phone already exist? Idle until the phone passes the
 * form's phone rule. The key holds the phone, so it is never persisted.
 */
export function useCheckPhone(phone: string, excludeId?: string) {
  const { orgId, locationId, ready } = usePatientTenant();
  const value = phone.trim();
  return useQuery({
    queryKey: patientKeys.checkPhone(orgId, locationId, value, excludeId ?? null),
    queryFn: () => checkPatientPhone(value, excludeId),
    enabled: ready && isValidPhone(value),
    staleTime: 30_000,
  });
}
