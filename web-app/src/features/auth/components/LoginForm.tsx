import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { isLabOnlyUser, useAuthStore } from '@/store/useAuthStore'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { AuthError, AuthHeading } from './AuthPrimitives'
import {
  authAltClass,
  authInputClass,
  authInputWithActionClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from './authStyles'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const setAuth = useAuthStore((state) => state.setAuth)
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const parsed = loginSchema.parse(value)
        const response = await apiClient.post('/auth/login', {
          ...parsed,
          rememberMe,
        })

        if (response.data?.isSuccess) {
          const {
            user,
            accessToken,
            isSuperAdmin,
            accessSource,
            requiresOrgSelection,
            requiresLocationSelection,
            accessibleOrganizations,
            activeOrganizationId,
            activeLocationId,
            labMemberships = [],
          } = response.data.data

          setAuth({
            user,
            accessToken,
            isSuperAdmin,
            accessSource,
            requiresOrgSelection,
            requiresLocationSelection,
            accessibleOrganizations,
            activeOrganizationId,
            activeLocationId,
            labMemberships,
          })

          toast.success('Welcome back!', {
            description: `Logged in as ${user.name || user.email}`,
          })

          // Redirect based on what selection is needed
          if (
            isLabOnlyUser({
              isSuperAdmin,
              accessibleOrganizations: accessibleOrganizations ?? [],
              labMemberships,
            })
          ) {
            navigate({ to: '/lab-portal' })
          } else if (requiresOrgSelection || requiresLocationSelection) {
            navigate({ to: '/select-location' })
          } else {
            navigate({ to: '/' }) // → the user's home page
          }
        }
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          setGlobalError(err.issues[0].message)
        } else {
          const msg = err.response?.data?.message
          setGlobalError(
            Array.isArray(msg)
              ? msg[0]
              : msg || 'Failed to login. Please try again.',
          )
        }
      }
    },
  })

  return (
    <AuthLayout>
      <AuthHeading
        title="Welcome back"
        subtitle="Sign in to continue to your clinic workspace."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          {/* Email */}
          <div>
            <Label htmlFor="login-email" className={authLabelClass}>
              Email
            </Label>
            <form.Field name="email">
              {(field) => (
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@clinic.com"
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

          {/* Password */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <Label
                htmlFor="login-password"
                className={`${authLabelClass} mb-0`}
              >
                Password
              </Label>
              <button
                type="button"
                onClick={() => navigate({ to: '/forgot-password' })}
                className="cursor-pointer text-[12.5px] font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                Forgot password?
              </button>
            </div>
            <form.Field name="password">
              {(field) => (
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="current-password"
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
          </div>
        </div>

        {/* Keep me signed in */}
        <div className="mt-4 mb-5">
          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border bg-surface transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background"
            >
              {rememberMe && (
                <Check
                  className="size-3 text-primary-foreground"
                  strokeWidth={3}
                />
              )}
            </span>
            Keep me signed in for 30 days
          </label>
          <p className="mt-1.5 pl-[28px] text-[11.5px] text-muted-foreground/80">
            Otherwise you&rsquo;ll be signed out after 1 day.
          </p>
        </div>

        {globalError ? (
          <div className="mt-4">
            <AuthError message={globalError} />
          </div>
        ) : null}

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
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          )}
        </form.Subscribe>

        <p className={authAltClass}>
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => navigate({ to: '/register' })}
            className={`cursor-pointer ${authTextLinkClass}`}
          >
            Sign up
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
