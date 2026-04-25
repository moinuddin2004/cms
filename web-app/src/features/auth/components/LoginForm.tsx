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
import { useAuthStore } from '@/store/useAuthStore'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Stethoscope } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
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
          })

          toast.success('Welcome back!', {
            description: `Logged in as ${user.name || user.email}`,
          })

          // Redirect based on what selection is needed
          if (requiresOrgSelection || requiresLocationSelection) {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
      {/* Clinic Logo */}
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
            Welcome back
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your credentials to access your clinic
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
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="doctor@medtrackr.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="email"
                    className="h-11"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="px-0 h-auto font-normal text-xs text-muted-foreground hover:text-primary"
                      onClick={() => navigate({ to: '/forgot-password' })}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                      autoComplete="current-password"
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
                </div>
              )}
            </form.Field>

            {globalError && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {globalError}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-2">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold transition-all active:scale-[0.98]"
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
            <div className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-semibold cursor-pointer"
                onClick={() => navigate({ to: '/register' })}
              >
                Sign up
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
