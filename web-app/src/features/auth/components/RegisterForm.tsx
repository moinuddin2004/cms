import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthLayout } from './AuthLayout'
import { AuthError, AuthHeading } from './AuthPrimitives'
import { PasswordStrength } from './PasswordStrength'
import {
  authAltClass,
  authInputClass,
  authInputWithActionClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from './authStyles'

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
      <AuthHeading
        title="Create your clinic"
        subtitle="Start your 14-day free trial. No card needed."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          {/* Clinic name */}
          <div>
            <Label htmlFor="register-clinic" className={authLabelClass}>
              Clinic name
            </Label>
            <form.Field name="clinicName">
              {(field) => (
                <Input
                  id="register-clinic"
                  placeholder="City Care Clinic"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="organization"
                  className={authInputClass}
                />
              )}
            </form.Field>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="register-name" className={authLabelClass}>
              Your name
            </Label>
            <form.Field name="name">
              {(field) => (
                <Input
                  id="register-name"
                  placeholder="Dr. John Doe"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="name"
                  className={authInputClass}
                />
              )}
            </form.Field>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="register-email" className={authLabelClass}>
              Email
            </Label>
            <form.Field name="email">
              {(field) => (
                <Input
                  id="register-email"
                  type="email"
                  placeholder="doctor@clinic.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="email"
                  className={authInputClass}
                />
              )}
            </form.Field>
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="register-phone" className={authLabelClass}>
              Phone{' '}
              <span className="font-normal text-text-3">(optional)</span>
            </Label>
            <form.Field name="phone">
              {(field) => (
                <Input
                  id="register-phone"
                  type="tel"
                  placeholder="0300 1234567"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="tel"
                  className={authInputClass}
                />
              )}
            </form.Field>
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="register-password" className={authLabelClass}>
              Password
            </Label>
            <form.Field name="password">
              {(field) => (
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="new-password"
                    className={authInputWithActionClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
                  >
                    {showPassword ? (
                      <EyeOff className="size-[17px]" />
                    ) : (
                      <Eye className="size-[17px]" />
                    )}
                  </button>
                </div>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) =>
                field.state.value ? (
                  <div className="mt-2.5">
                    <PasswordStrength password={field.state.value} />
                  </div>
                ) : null
              }
            </form.Field>
          </div>
        </div>

        <div className="mt-4">
          <AuthError message={globalError} />
        </div>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              className={`group ${authSubmitClass}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating your clinic...
                </>
              ) : (
                <>
                  Create clinic
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          )}
        </form.Subscribe>

        <p className={authAltClass}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate({ to: '/login' })}
            className={`cursor-pointer ${authTextLinkClass}`}
          >
            Sign in
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
