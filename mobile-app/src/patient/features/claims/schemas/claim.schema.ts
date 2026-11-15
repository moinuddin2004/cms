import { z } from 'zod';

import { t } from '@/core/i18n';

/** The choices offered on the confirm page (docs/06 P-01); `spouse` stays a server value but is not offered. */
export const CLAIM_RELATIONS = ['self', 'child', 'parent', 'other'] as const;

export const claimSchema = z
  .object({
    relation: z.enum(CLAIM_RELATIONS),
    newProfileName: z
      .string()
      .trim()
      .max(150, { error: () => t('auth.name.tooLong') }),
    confirm: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.relation !== 'self' && value.newProfileName.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['newProfileName'],
        message: t('claim.confirm.nameRequired'),
      });
    }
    if (!value.confirm) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirm'],
        message: t('claim.confirm.consentRequired'),
      });
    }
  });

export type ClaimFormValues = z.input<typeof claimSchema>;
