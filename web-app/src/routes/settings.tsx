import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/useAuthStore'
import { Navigate } from '@tanstack/react-router'
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
import { SessionManagement } from '@/features/auth/components/SessionManagement'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
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
import { useTheme, type Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  DENTIST: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  RECEPTIONIST: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  DENTIST: 'Dentist',
  RECEPTIONIST: 'Receptionist',
}

function SettingsPage() {
  const { accessToken, user } = useAuthStore()

  if (!accessToken) {
    return <Navigate to="/login" />
  }

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
    <DashboardLayout title="Settings">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* User Profile Header */}
        <Card className="border-border/50 shadow-sm rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-2xl font-bold">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold text-foreground">
                  {user?.name || 'User'}
                </h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${ROLE_COLORS[user?.role || ''] || 'bg-muted text-muted-foreground'}`}
                >
                  {ROLE_LABELS[user?.role || ''] || user?.role || 'Member'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-muted/50 rounded-lg p-1 h-auto">
            <TabsTrigger
              value="profile"
              className="gap-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
            >
              <User className="h-4 w-4" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="gap-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
            >
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="gap-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
            >
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="gap-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
            >
              <Monitor className="h-4 w-4" />
              Sessions
            </TabsTrigger>
          </TabsList>

          {/* Tab: Personal Info */}
          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>

          {/* Tab: Appearance */}
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>

          {/* Tab: Security */}
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>

          {/* Tab: Sessions */}
          <TabsContent value="sessions">
            <SessionManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

/** Appearance Tab — Theme Switcher */
function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  const themeOptions: {
    value: Theme
    label: string
    description: string
    icon: React.ElementType
  }[] = [
    {
      value: 'light',
      label: 'Light',
      description: 'Clean and bright interface',
      icon: Sun,
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes',
      icon: Moon,
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follows your OS setting',
      icon: Monitor,
    },
  ]

  return (
    <Card className="shadow-sm border-border/50 rounded-xl">
      <CardHeader>
        <CardTitle className="text-lg">Appearance</CardTitle>
        <CardDescription>
          Choose how MedTrackr looks for you. Select a theme that suits your
          preference.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {themeOptions.map((option) => {
            const isActive = theme === option.value
            const Icon = option.icon

            return (
              <button
                key={option.value}
                id={`theme-option-${option.value}`}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer',
                  'hover:shadow-md hover:scale-[1.02]',
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80',
                )}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground',
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>

                {/* Label */}
                <div className="text-center">
                  <p
                    className={cn(
                      'font-semibold text-sm',
                      isActive ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Current theme indicator */}
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
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

/** Personal Info Tab */
function ProfileTab() {
  const { user } = useAuthStore()

  return (
    <Card className="shadow-sm border-border/50 rounded-xl">
      <CardHeader>
        <CardTitle className="text-lg">Personal Information</CardTitle>
        <CardDescription>View your profile details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Full Name
            </Label>
            <p className="text-sm font-medium">{user?.name || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Email Address
            </Label>
            <p className="text-sm font-medium">{user?.email || '—'}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Role
            </Label>
            <div>
              <Badge
                variant="outline"
                className={`font-medium ${ROLE_COLORS[user?.role || ''] || 'bg-muted text-muted-foreground'}`}
              >
                {ROLE_LABELS[user?.role || ''] || user?.role || 'Member'}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              User ID
            </Label>
            <p className="text-sm font-mono text-muted-foreground">
              {user?.uuid?.slice(0, 8)}...
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Security Tab — Change Password */
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
          setGlobalError(
            Array.isArray(msg) ? msg[0] : msg || 'Failed to change password',
          )
        }
      }
    },
  })

  return (
    <Card className="shadow-sm border-border/50 rounded-xl">
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
          className="space-y-5 max-w-md"
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
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowCurrent(!showCurrent)}
                    tabIndex={-1}
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
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
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowNew(!showNew)}
                    tabIndex={-1}
                  >
                    {showNew ? (
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
            <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              {globalError}
            </div>
          )}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} className="h-10">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                    Updating...
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
