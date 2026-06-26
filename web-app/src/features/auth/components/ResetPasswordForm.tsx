import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

const resetSchema = z
  .object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  // @ts-ignore
  const search = useSearch({ strict: false })
  const token = (search as any)?.token || ''

  const form = useForm({
    defaultValues: { newPassword: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const parsed = resetSchema.parse(value)
        await apiClient.patch('/auth/reset-password', {
          token,
          newPassword: parsed.newPassword,
        })
        setSuccess(true)
        toast.success('Password reset successful!')
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          setGlobalError(err.issues[0].message)
        } else {
          const msg = err.response?.data?.message
          setGlobalError(
            Array.isArray(msg)
              ? msg[0]
              : msg || 'Failed to reset password. Link may be expired.',
          )
        }
      }
    },
  })

  if (!token) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">
            Invalid Reset Link
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            This password reset link is invalid or missing the token.
          </p>
          <Button
            onClick={() => navigate({ to: '/login' })}
            className="w-full h-[46px] font-semibold text-[15px] rounded-[11px] cursor-pointer"
          >
            Back to Login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-5">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">
            Password Reset Successful
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Your password has been updated. All sessions have been revoked for
            security.
          </p>
          <Button
            onClick={() => navigate({ to: '/login' })}
            className="w-full h-[46px] font-semibold text-[15px] rounded-[11px] cursor-pointer"
          >
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      {/* Header */}
      <div className="mb-7">
        <div className="text-2xl font-extrabold tracking-tight text-foreground">
          Set new password
        </div>
        <div className="text-sm text-muted-foreground mt-1.5">
          Choose a strong password for your account
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {/* New password field */}
        <div className="mb-4">
          <Label htmlFor="new-password" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            New Password
          </Label>
          <form.Field name="newPassword">
            {(field) => (
              <>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="new-password"
                    className="h-11 pl-[38px] pr-10 rounded-[10px] bg-panel border-border text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-[17px] w-[17px]" />
                    ) : (
                      <Eye className="h-[17px] w-[17px]" />
                    )}
                  </Button>
                </div>
                {field.state.value && (
                  <div className="mt-2">
                    <PasswordStrength password={field.state.value} />
                  </div>
                )}
              </>
            )}
          </form.Field>
        </div>

        {/* Confirm password field */}
        <div className="mb-5">
          <Label htmlFor="confirm-password" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Confirm Password
          </Label>
          <form.Field name="confirmPassword">
            {(field) => (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="new-password"
                  className="h-11 pl-[38px] rounded-[10px] bg-panel border-border text-sm"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Error */}
        {globalError && (
          <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 mb-4">
            {globalError}
          </div>
        )}

        {/* Submit */}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              className="w-full h-[46px] font-semibold text-[15px] rounded-[11px] transition-all active:scale-[0.98] cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthLayout>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const getStrength = (pwd: string) => {
    let score = 0
    if (pwd.length >= 6) score++
    if (pwd.length >= 8) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++

    if (score <= 1) return { level: 1, text: 'Weak', color: 'bg-red-500' }
    if (score <= 2) return { level: 2, text: 'Fair', color: 'bg-orange-500' }
    if (score <= 3) return { level: 3, text: 'Good', color: 'bg-yellow-500' }
    if (score <= 4) return { level: 4, text: 'Strong', color: 'bg-emerald-500' }
    return { level: 5, text: 'Very Strong', color: 'bg-green-600' }
  }

  const strength = getStrength(password)

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= strength.level ? strength.color : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: <span className="font-medium">{strength.text}</span>
      </p>
    </div>
  )
}
