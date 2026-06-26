import { useState } from 'react'
import {
  Eye,
  EyeOff,
  Loader2,
  User,
  Shield,
  Monitor,
  Sun,
  Moon,
  Palette,
} from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SessionManagement } from '@/features/auth/components/SessionManagement'
import { useAuthStore } from '@/store/useAuthStore'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import apiClient from '@/lib/api'

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-primary-soft text-primary-text border-primary',
  DENTIST: 'bg-emerald-soft text-emerald border-emerald',
  RECEPTIONIST: 'bg-violet-soft text-violet border-violet',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  DENTIST: 'Dentist',
  RECEPTIONIST: 'Receptionist',
}

export function SettingsPage() {
  const { user } = useAuthStore()

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <PageWrapper
        title="Settings"
      />
      <div className="mx-auto mt-5 max-w-4xl space-y-6">
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-2xl font-bold text-primary">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold text-foreground">
                  {user?.name || 'User'}
                </h2>
                <p className="text-sm text-text-2">{user?.email}</p>
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${ROLE_COLORS[user?.globalRole || ''] || 'bg-panel-2 text-text-2'}`}
                >
                  {ROLE_LABELS[user?.globalRole || ''] || user?.globalRole || 'Member'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="h-auto rounded-lg bg-panel p-1">
            <TabsTrigger
              value="profile"
              className="gap-2 rounded-md px-4 py-2 data-[state=active]:bg-surface data-[state=active]:shadow-sm"
            >
              <User className="size-4" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="gap-2 rounded-md px-4 py-2 data-[state=active]:bg-surface data-[state=active]:shadow-sm"
            >
              <Palette className="size-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="gap-2 rounded-md px-4 py-2 data-[state=active]:bg-surface data-[state=active]:shadow-sm"
            >
              <Shield className="size-4" />
              Security
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="gap-2 rounded-md px-4 py-2 data-[state=active]:bg-surface data-[state=active]:shadow-sm"
            >
              <Monitor className="size-4" />
              Sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionManagement />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  const themeOptions: {
    value: Theme
    label: string
    description: string
    icon: React.ElementType
  }[] = [
    { value: 'light', label: 'Light', description: 'Clean and bright interface', icon: Sun },
    { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
    { value: 'system', label: 'System', description: 'Follows your OS setting', icon: Monitor },
  ]

  return (
    <Card className="rounded-xl border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Appearance</CardTitle>
        <CardDescription>
          Choose how MedTrackr looks for you. Select a theme that suits your preference.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const isActive = theme === option.value
            const Icon = option.icon
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'group relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all duration-200',
                  'hover:scale-[1.02] hover:shadow-md',
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border bg-surface hover:border-border/80',
                )}
              >
                {isActive && (
                  <div className="absolute right-3 top-3 size-2.5 animate-pulse rounded-full bg-primary" />
                )}
                <div
                  className={cn(
                    'flex size-12 items-center justify-center rounded-xl transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-panel-2 text-text-3 group-hover:bg-panel group-hover:text-foreground',
                  )}
                >
                  <Icon className="size-6" />
                </div>
                <div className="text-center">
                  <p className={cn('text-sm font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-text-3">{option.description}</p>
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-6 flex items-center gap-2 text-sm text-text-2">
          <div className="size-1.5 rounded-full bg-primary" />
          <span>
            Currently using{' '}
            <span className="font-medium text-foreground">
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </span>{' '}
            theme
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileTab() {
  const { user } = useAuthStore()
  return (
    <Card className="rounded-xl border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Personal Information</CardTitle>
        <CardDescription>View your profile details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-text-3">Full Name</Label>
            <p className="text-sm font-medium">{user?.name || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-text-3">Email Address</Label>
            <p className="text-sm font-medium">{user?.email || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-text-3">Role</Label>
            <div>
              <Badge
                variant="outline"
                className={`font-medium ${ROLE_COLORS[user?.globalRole || ''] || 'bg-panel-2 text-text-2'}`}
              >
                {ROLE_LABELS[user?.globalRole || ''] || user?.globalRole || 'Member'}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-text-3">User ID</Label>
            <p className="font-mono text-sm text-text-3">{user?.uuid?.slice(0, 8)}...</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SecurityTab() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [globalError, setGlobalError] = useState('')

  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(6, 'Password must be at least 6 characters'),
      confirmPassword: z.string().min(6, 'Please confirm your password'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    })

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const parsed = changePasswordSchema.parse(value)
        await apiClient.post('/auth/change-password', {
          currentPassword: parsed.currentPassword,
          newPassword: parsed.newPassword,
          revokeOtherSessions: true,
        })
        toast.success('Password changed!', {
          description: 'Other sessions have been revoked.',
        })
        form.reset()
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          setGlobalError(err.issues[0].message)
        } else {
          const msg = err.response?.data?.message
          setGlobalError(Array.isArray(msg) ? msg[0] : msg || 'Failed to change password')
        }
      }
    },
  })

  return (
    <Card className="rounded-xl border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Change Password</CardTitle>
        <CardDescription>
          Update your password. Other sessions will be revoked for security.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="max-w-md space-y-5"
        >
          <form.Field name="currentPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="current-pwd">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-pwd"
                    type={showCurrent ? 'text' : 'password'}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    className="h-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-text-3 hover:bg-transparent hover:text-foreground"
                    onClick={() => setShowCurrent(!showCurrent)}
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
            )}
          </form.Field>

          <form.Field name="newPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="new-pwd">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-pwd"
                    type={showNew ? 'text' : 'password'}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    className="h-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 text-text-3 hover:bg-transparent hover:text-foreground"
                    onClick={() => setShowNew(!showNew)}
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                {field.state.value && <PasswordStrength password={field.state.value} />}
              </div>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="confirm-pwd">Confirm New Password</Label>
                <Input
                  id="confirm-pwd"
                  type="password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  className="h-10"
                />
              </div>
            )}
          </form.Field>

          {globalError && (
            <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
              {globalError}
            </div>
          )}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} className="h-10">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
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

    if (score <= 1) return { level: 1, text: 'Weak', color: 'bg-danger' }
    if (score <= 2) return { level: 2, text: 'Fair', color: 'bg-amber' }
    if (score <= 3) return { level: 3, text: 'Good', color: 'bg-amber' }
    if (score <= 4) return { level: 4, text: 'Strong', color: 'bg-emerald' }
    return { level: 5, text: 'Very Strong', color: 'bg-emerald' }
  }

  const strength = getStrength(password)

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= strength.level ? strength.color : 'bg-panel-2'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-text-3">
        Strength: <span className="font-medium">{strength.text}</span>
      </p>
    </div>
  )
}
