import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ShieldCheck, Stethoscope } from 'lucide-react'

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
        <Card className="w-full max-w-[420px] shadow-xl border-0 bg-card/80 backdrop-blur-sm rounded-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">
              Invalid Reset Link
            </CardTitle>
            <CardDescription>
              This password reset link is invalid or missing the token.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => navigate({ to: '/login' })}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
        <Card className="w-full max-w-[420px] shadow-xl border-0 bg-card/80 backdrop-blur-sm rounded-2xl">
          <CardHeader className="text-center space-y-4 pt-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">
              Password Reset Successful
            </CardTitle>
            <CardDescription className="text-base">
              Your password has been updated. All sessions have been revoked for
              security.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2 pb-8">
            <Button
              onClick={() => navigate({ to: '/login' })}
              className="w-full h-11"
            >
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-gradient-to-br from-primary to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Stethoscope className="w-7 h-7 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground tracking-tight">
          MedTrackr
        </span>
      </div>

      <Card className="w-full max-w-[420px] shadow-xl border-0 bg-card/80 backdrop-blur-sm rounded-2xl">
        <CardHeader className="space-y-1 text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Set new password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a strong password for your account
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <CardContent className="space-y-4 pt-2">
            <form.Field name="newPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                      autoComplete="new-password"
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {field.state.value && (
                    <PasswordStrength password={field.state.value} />
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="new-password"
                    className="h-11"
                  />
                </div>
              )}
            </form.Field>

            {globalError && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {globalError}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold"
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
          </CardFooter>
        </form>
      </Card>
    </div>
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
