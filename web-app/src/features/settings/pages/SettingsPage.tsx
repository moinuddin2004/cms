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
  Camera,
} from 'lucide-react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { SessionManagement } from '@/features/auth/components/SessionManagement'
import { useAuthStore } from '@/store/useAuthStore'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import apiClient from '@/lib/api'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  DENTIST: 'Dentist',
  RECEPTIONIST: 'Receptionist',
}

type SectionId = 'profile' | 'appearance' | 'security' | 'sessions'

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'sessions', label: 'Sessions', icon: Monitor },
]

function getInitials(name?: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function SettingsPage() {
  const [active, setActive] = useState<SectionId>('profile')

  return (
    <>
      <PageWrapper title="Settings" />
      <div className="mt-5 grid max-w-5xl gap-6 md:grid-cols-[200px_1fr]">
        {/* Left rail nav */}
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            const isActive = active === section.id
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-soft text-primary-text'
                    : 'text-text-2 hover:bg-panel',
                )}
              >
                <Icon className="size-4" />
                {section.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex flex-col gap-[18px]">
          {active === 'profile' && <ProfileSection />}
          {active === 'appearance' && <AppearanceSection />}
          {active === 'security' && <SecuritySection />}
          {active === 'sessions' && <SessionManagement />}
        </div>
      </div>
    </>
  )
}

/* ── Card shell matching the mock ──────────────────────────────────── */

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-[22px]">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      {description && (
        <p className="mb-5 mt-1 text-[13px] text-text-3">{description}</p>
      )}
      <div className={description ? '' : 'mt-5'}>{children}</div>
    </section>
  )
}

/* ── Profile ───────────────────────────────────────────────────────── */

function ProfileSection() {
  const { user } = useAuthStore()
  const roleLabel = ROLE_LABELS[user?.globalRole || ''] || user?.globalRole || 'Member'

  return (
    <SettingsCard
      title="Profile"
      description="This information is visible to your team."
    >
      <div className="mb-6 flex items-center gap-4">
        <div className="flex size-[60px] items-center justify-center rounded-full bg-primary-soft text-xl font-extrabold text-primary-text">
          {getInitials(user?.name)}
        </div>
        <Button variant="outline" size="sm" className="h-9" disabled>
          <Camera className="mr-2 size-4" />
          Change photo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">Full name</Label>
          <Input value={user?.name || '—'} readOnly className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">Email</Label>
          <Input value={user?.email || '—'} readOnly className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">Role</Label>
          <Input
            value={roleLabel}
            disabled
            className="h-10 bg-panel text-text-3"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">User ID</Label>
          <Input
            value={user?.uuid ? `${user.uuid.slice(0, 8)}…` : '—'}
            disabled
            className="h-10 bg-panel font-mono text-text-3"
          />
        </div>
      </div>
    </SettingsCard>
  )
}

/* ── Appearance ────────────────────────────────────────────────────── */

function AppearanceSection() {
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
    <SettingsCard
      title="Appearance"
      description="Choose how MedTrackr looks for you. Select a theme that suits your preference."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {themeOptions.map((option) => {
          const isActive = theme === option.value
          const Icon = option.icon
          return (
            <button
              key={option.value}
              type="button"
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
    </SettingsCard>
  )
}

/* ── Security ──────────────────────────────────────────────────────── */

function SecuritySection() {
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
    <SettingsCard
      title="Change Password"
      description="Update your password. Other sessions will be revoked for security."
    >
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
              <Label htmlFor="current-pwd" className="text-[13px] font-semibold">
                Current Password
              </Label>
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
              <Label htmlFor="new-pwd" className="text-[13px] font-semibold">
                New Password
              </Label>
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
              <Label htmlFor="confirm-pwd" className="text-[13px] font-semibold">
                Confirm New Password
              </Label>
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
    </SettingsCard>
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
