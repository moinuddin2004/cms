import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const parsed = registerSchema.parse(value)
        const response = await apiClient.post('/auth/register', parsed)

        if (response.data?.isSuccess) {
          toast.success('Account created!', {
            description: 'Please sign in with your new credentials',
          })
          navigate({ to: '/login' })
        }
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          setGlobalError(err.issues[0].message)
        } else {
          const msg = err.response?.data?.message
          setGlobalError(
            Array.isArray(msg)
              ? msg[0]
              : msg || 'Registration failed. Please try again.',
          )
        }
      }
    },
  })

  return (
    <AuthLayout>
      {/* Header */}
      <div className="mb-7">
        <div className="text-2xl font-extrabold tracking-tight text-foreground">
          Create an account
        </div>
        <div className="text-sm text-muted-foreground mt-1.5">
          Enter your details to get started
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {/* Name field */}
        <div className="mb-4">
          <Label htmlFor="register-name" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Full Name
          </Label>
          <form.Field name="name">
            {(field) => (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="register-name"
                  placeholder="Dr. John Doe"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="name"
                  className="h-11 pl-[38px] rounded-[10px] bg-panel border-border text-sm"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Email field */}
        <div className="mb-4">
          <Label htmlFor="register-email" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Email
          </Label>
          <form.Field name="email">
            {(field) => (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="register-email"
                  type="email"
                  placeholder="doctor@clinic.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="email"
                  className="h-11 pl-[38px] rounded-[10px] bg-panel border-border text-sm"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Password field */}
        <div className="mb-4">
          <Label htmlFor="register-password" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Password
          </Label>
          <form.Field name="password">
            {(field) => (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="register-password"
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
            )}
          </form.Field>
          {/* Password strength indicator */}
          <form.Field name="password">
            {(field) =>
              field.state.value ? (
                <div className="mt-2">
                  <PasswordStrength password={field.state.value} />
                </div>
              ) : null
            }
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
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          )}
        </form.Subscribe>

        {/* Login link */}
        <div className="text-[13px] text-muted-foreground mt-[18px]">
          Already have an account?{' '}
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto font-semibold text-primary cursor-pointer"
            onClick={() => navigate({ to: '/login' })}
          >
            Sign in
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}

/** Password strength indicator bar */
function PasswordStrength({ password }: { password: string }) {
  const getStrength = (
    pwd: string,
  ): { level: number; text: string; color: string } => {
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
        Password strength: <span className="font-medium">{strength.text}</span>
      </p>
    </div>
  )
}
