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

/** New clinic for a verified Google account (no password). */
export const googleRegisterSchema = z.object({
  clinicName: z.string().trim().min(2, 'Enter your clinic name'),
  phone: z.string().trim().max(20, 'At most 20 characters'),
})

export type GoogleRegisterFormValues = z.input<typeof googleRegisterSchema>

/** Ask to join a clinic that takes requests from the Google account's domain. */
export const joinRequestSchema = z.object({
  organizationId: z.string().min(1, 'Choose a clinic'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter your phone number')
    .max(20, 'At most 20 characters'),
  message: z.string().trim().max(500, 'At most 500 characters'),
})

export type JoinRequestFormValues = z.input<typeof joinRequestSchema>

/** A signed-in user with no clinic creates one. */
export const createClinicSchema = googleRegisterSchema

export type CreateClinicFormValues = GoogleRegisterFormValues

/** Join through a clinic's invite link (after choosing a Google account). */
export const inviteJoinSchema = joinRequestSchema.omit({ organizationId: true })

export type InviteJoinFormValues = z.input<typeof inviteJoinSchema>
