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
import { Loader2, MailCheck, Stethoscope } from 'lucide-react'

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email'),
})

export function ForgotPasswordForm() {
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const parsed = forgotSchema.parse(value)
        await apiClient.post('/auth/forgot-password', parsed)
        setSuccess(true)
        toast.success('Reset link sent!', {
          description: 'Check your email inbox.',
        })
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          setGlobalError(err.issues[0].message)
        } else {
          setGlobalError(
            err.response?.data?.message ||
              'Failed to process request. Try again.',
          )
        }
      }
    },
  })

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4">
        <Card className="w-full max-w-[420px] shadow-xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl">
          <CardHeader className="text-center space-y-4 pt-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <MailCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">
              Check your email
            </CardTitle>
            <CardDescription className="text-base">
              If an account exists with that email, we&apos;ve sent a password
              reset link.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2 pb-8">
            <Button
              onClick={() => navigate({ to: '/login' })}
              className="w-full h-11"
            >
              Return to Login
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

      <Card className="w-full max-w-[420px] shadow-xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl">
        <CardHeader className="space-y-1 text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Forgot Password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link
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
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
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
                  className="w-full h-11 font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset instructions'
                  )}
                </Button>
              )}
            </form.Subscribe>
            <div className="text-sm text-center text-muted-foreground">
              Remember your password?{' '}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-semibold"
                onClick={() => navigate({ to: '/login' })}
              >
                Back to login
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
