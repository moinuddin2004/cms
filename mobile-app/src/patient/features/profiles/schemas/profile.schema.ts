import { z } from 'zod';

import { t } from '@/core/i18n';

import { checkDob } from '../lib/dob';

// Messages are functions so they are looked up at validation time, in the
// language the user has now.

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: () => t('family.sheet.nameRequired') })
    .max(150, { error: () => t('family.sheet.nameTooLong') }),
  relation: z.enum(['self', 'child', 'parent', 'spouse', 'other'], {
    error: () => t('family.sheet.relationRequired'),
  }),
  /** Empty = not given. */
  dob: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) return;
      const check = checkDob(value);
      if (check === 'invalid') ctx.addIssue({ code: 'custom', message: t('family.sheet.dobInvalid') });
      if (check === 'future') ctx.addIssue({ code: 'custom', message: t('family.sheet.dobFuture') });
    }),
  /** Empty = not given. */
  gender: z.enum(['', 'male', 'female', 'other']),
});
export type ProfileFormValues = z.input<typeof profileSchema>;
