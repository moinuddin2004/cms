import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowRight,
  Building2,
  Check,
  Copy,
  Link2,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { AuthHeading } from './AuthPrimitives'
import { authAltClass, authSubmitClass, authTextLinkClass } from './authStyles'
import { useGoogleSignupStore } from '../store/useGoogleSignupStore'

/**
 * Login with a Google account that has no login here. We can't tell an
 * owner from staff, so say both: register your clinic, or ask your clinic
 * for an invite link (or to be added with this email).
 */
export function NoAccountPanel() {
  const navigate = useNavigate()
  const profile = useGoogleSignupStore((s) => s.profile)
  const clinics = useGoogleSignupStore((s) => s.joinableClinics)
  const clear = useGoogleSignupStore((s) => s.clear)
  const [copied, setCopied] = useState(false)

  if (!profile) return null

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(profile!.email)
      setCopied(true)
      toast.success('Email copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the email and copy it.')
    }
  }

  return (
    <>
      <AuthHeading
        title="No account yet"
        subtitle={
          <>
            There is no account for{' '}
            <span className="font-medium text-foreground">{profile.email}</span>
            .
          </>
        }
      />

      <div className="space-y-3">
        {/* Owner */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">
                Setting up a new clinic?
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                Register it with this Google account. New clinics are reviewed
                before they go live.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className={`group mt-4 ${authSubmitClass}`}
            onClick={() => navigate({ to: '/register' })}
          >
            {clinics.length
              ? 'Register or join a clinic'
              : 'Register your clinic'}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>

        {/* Staff */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-muted-foreground">
              <UserRound className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">
                Work at a clinic?
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                Ask your clinic owner for an{' '}
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Link2 className="size-3.5" />
                  invite link
                </span>
                , or to add you under Employees with this email. Then sign in
                with Google again.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-panel-2 py-1 pr-1 pl-3">
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                  {profile.email}
                </span>
                <TooltipButton
                  tooltip={copied ? 'Copied' : 'Copy email'}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={copyEmail}
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </TooltipButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className={authAltClass}>
        Wrong account?{' '}
        <button
          type="button"
          onClick={clear}
          className={`cursor-pointer ${authTextLinkClass}`}
        >
          Use a different one
        </button>
      </p>
    </>
  )
}
