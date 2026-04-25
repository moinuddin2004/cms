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
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Stethoscope } from 'lucide-react'

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
            Create an account
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your details to get started
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
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="register-name">Full Name</Label>
                  <Input
                    id="register-name"
                    placeholder="Dr. John Doe"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="name"
                    className="h-11"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="doctor@clinic.com"
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
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="register-password"
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
                  {/* Password strength indicator */}
                  {field.state.value && (
                    <PasswordStrength password={field.state.value} />
                  )}
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
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              )}
            </form.Subscribe>
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-semibold"
                onClick={() => navigate({ to: '/login' })}
              >
                Sign in
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
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
