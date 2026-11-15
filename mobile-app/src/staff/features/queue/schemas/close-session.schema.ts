import { z } from 'zod';

/** One leftover patient's choice. A transfer needs the target doctor. */
const draftSchema = z
  .object({
    action: z.enum(['cancel', 'transfer', '']),
    toDoctorId: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.action === '') ctx.addIssue({ code: 'custom', message: 'Choose cancel or transfer' });
    else if (d.action === 'transfer' && !d.toDoctorId)
      ctx.addIssue({ code: 'custom', message: 'Choose a doctor', path: ['toDoctorId'] });
  });

/** Close-session form: a decision per leftover patient, keyed by entry id. */
export const closeSessionSchema = z.object({
  drafts: z.record(z.string(), draftSchema),
});

export type CloseSessionValues = z.input<typeof closeSessionSchema>;
