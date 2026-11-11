import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.input<typeof loginSchema>;
