import { z } from 'zod';

/** "Mark urgent" — the server refuses without a reason. */
export const urgentReasonSchema = z.object({
  reason: z.string().trim().min(1, 'Enter the reason').max(500, 'Max 500 characters'),
});

export type UrgentReasonValues = z.input<typeof urgentReasonSchema>;
