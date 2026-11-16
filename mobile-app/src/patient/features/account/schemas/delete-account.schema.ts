import { z } from 'zod';

import { t } from '@/core/i18n';

/** The word the user must type, and the value the API expects (`{ confirm: 'DELETE' }`). */
export const DELETE_WORD = 'DELETE';

export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .trim()
    .refine((value) => value === DELETE_WORD, { error: () => t('account.delete.mismatch') }),
});
export type DeleteAccountFormValues = z.input<typeof deleteAccountSchema>;
