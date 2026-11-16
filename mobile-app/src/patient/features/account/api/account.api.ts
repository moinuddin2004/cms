import { patientApi } from '@/patient/lib/api';

import { DELETE_WORD } from '../schemas/delete-account.schema';

/**
 * Irreversible: the server revokes every link and session, removes the
 * sign-in identities and soft-deletes the account (07 §6.2).
 */
export async function deleteAccount(): Promise<void> {
  await patientApi.delete('/patient-api/me', { data: { confirm: DELETE_WORD } });
}
