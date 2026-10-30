import { z } from 'zod'

const email = z.email('Please enter a valid email')

const password = z.string().min(6, 'Password must be at least 6 characters')

export const loginSchema = z.object({
  email,
  password,
  rememberMe: z.boolean(),
})

export type LoginFormValues = z.input<typeof loginSchema>

export const registerSchema = z.object({
  clinicName: z.string().trim().min(2, 'Enter your clinic name'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().max(20, 'At most 20 characters'),
  email,
  password,
})

export type RegisterFormValues = z.input<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email })

export type ForgotPasswordFormValues = z.input<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ResetPasswordFormValues = z.input<typeof resetPasswordSchema>
