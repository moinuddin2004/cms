import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthLayout } from './AuthLayout'

const registerSchema = z.object({
  clinicName: z.string().trim().min(2, 'Enter your clinic name'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().max(20, 'At most 20 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const form = useForm({
    defaultValues: {
      clinicName: '',
      name: '',
      phone: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const parsed = registerSchema.parse(value)
        const response = await apiClient.post('/auth/register', {
          ...parsed,
          phone: parsed.phone || undefined,
        })

        if (response.data?.isSuccess) {
          // Signup also signs in (same payload as /auth/login).
          const d = response.data.data
          setAuth({
            user: d.user,
            accessToken: d.accessToken,
            isSuperAdmin: d.isSuperAdmin,
            accessSource: d.accessSource,
            requiresOrgSelection: d.requiresOrgSelection,
            requiresLocationSelection: d.requiresLocationSelection,
            accessibleOrganizations: d.accessibleOrganizations,
            activeOrganizationId: d.activeOrganizationId,
            activeLocationId: d.activeLocationId,
            labMemberships: d.labMemberships ?? [],
          })
          toast.success('Your clinic is ready', {
            description: 'Your 14-day free trial has started.',
          })
          navigate({ to: '/setup' })
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
          Start your free trial
        </div>
        <div className="text-sm text-muted-foreground mt-1.5">
          Create your clinic — 14 days free, no card needed
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {/* Clinic name field */}
        <div className="mb-4">
          <Label htmlFor="register-clinic" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Clinic Name
          </Label>
          <form.Field name="clinicName">
            {(field) => (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="register-clinic"
                  placeholder="City Care Clinic"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="organization"
                  className="h-11 pl-[38px] rounded-[10px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-colors"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Name field */}
        <div className="mb-4">
          <Label htmlFor="register-name" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Your Name
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
                  className="h-11 pl-[38px] rounded-[10px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-colors"
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
                  className="h-11 pl-[38px] rounded-[10px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-colors"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Phone field */}
        <div className="mb-4">
          <Label htmlFor="register-phone" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Phone <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <form.Field name="phone">
            {(field) => (
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="register-phone"
                  type="tel"
                  placeholder="0300 1234567"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="tel"
                  className="h-11 pl-[38px] rounded-[10px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-colors"
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
                  className="h-11 pl-[38px] pr-10 rounded-[10px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-colors"
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
                  Creating your clinic...
                </>
              ) : (
                'Create clinic'
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
