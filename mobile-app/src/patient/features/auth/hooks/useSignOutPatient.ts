import { useMutation, useQueryClient } from '@tanstack/react-query';

import { signOutPatient } from '../lib/sign-out';

/** Sign out of the patient space (wipes patient data only). */
export function useSignOutPatient() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => signOutPatient(queryClient) });
}
