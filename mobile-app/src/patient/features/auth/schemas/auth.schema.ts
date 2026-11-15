import { z } from 'zod';

import { t } from '@/core/i18n';

// Messages are functions so they are looked up at validation time, in the
// language the user has now.

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: () => t('auth.signIn.invalidEmail') })),
});
export type SignInFormValues = z.input<typeof signInSchema>;

export const verifyCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { error: () => t('auth.verify.codeInvalid') }),
});
export type VerifyCodeFormValues = z.input<typeof verifyCodeSchema>;

export const nameSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: () => t('auth.name.required') })
    .max(150, { error: () => t('auth.name.tooLong') }),
});
export type NameFormValues = z.input<typeof nameSchema>;
