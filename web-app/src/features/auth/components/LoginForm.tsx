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
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
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
        const response = await apiClient.post('/auth/login', parsed)

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
            navigate({ to: '/dashboard' })
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
      {/* Header */}
      <div className="mb-7">
        <div className="text-2xl font-extrabold tracking-tight text-foreground">
          Welcome back
        </div>
        <div className="text-sm text-muted-foreground mt-1.5">
          Sign in to your clinic workspace
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {/* Email field */}
        <div className="mb-4">
          <Label htmlFor="login-email" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Email
          </Label>
          <form.Field name="email">
            {(field) => (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@clinic.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="email"
                  className="h-11 pl-[38px] rounded-[10px] bg-background border-border text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-colors"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Password field */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-[7px]">
            <Label htmlFor="login-password" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
              Password
            </Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0 h-auto font-semibold text-xs text-primary hover:text-primary-hover cursor-pointer"
              onClick={() => navigate({ to: '/forgot-password' })}
            >
              Forgot password?
            </Button>
          </div>
          <form.Field name="password">
            {(field) => (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="current-password"
                  className="h-11 pl-[38px] pr-10 rounded-[10px] bg-background border-border text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-colors"
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
        </div>

        {/* Keep me signed in */}
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground my-3.5 cursor-pointer select-none">
          <button
            type="button"
            role="checkbox"
            aria-checked={rememberMe}
            onClick={() => setRememberMe(!rememberMe)}
            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
              rememberMe
                ? 'bg-primary text-white'
                : 'bg-transparent border-[1.5px] border-border'
            }`}
          >
            {rememberMe && (
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          Keep me signed in
        </label>

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
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          )}
        </form.Subscribe>

        {/* Register link */}
        <div className="text-[13px] text-muted-foreground mt-[18px]">
          Don&apos;t have an account?{' '}
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto font-semibold text-primary cursor-pointer"
            onClick={() => navigate({ to: '/register' })}
          >
            Sign up
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
