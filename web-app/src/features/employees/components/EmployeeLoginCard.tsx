import { useState } from 'react'
import { KeyRound, RotateCcw, Shield, ShieldOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useResetGoogleLink } from '../hooks/useResetGoogleLink'
import type { Employee } from '../types'

/** Portal access + how the employee signs in (password / Google). */
export function EmployeeLoginCard({
  employee,
  canManage,
}: {
  employee: Employee
  canManage: boolean
}) {
  const reset = useResetGoogleLink()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const login = employee.login

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <Shield className="size-5 text-muted-foreground" />
          Portal access
        </CardTitle>
      </CardHeader>
      <CardContent>
        {employee.hasPortalAccess ? (
          <div className="space-y-3">
            <Badge variant="success">
              <Shield />
              Can sign in
            </Badge>
            {login && (
              <div className="space-y-2 text-sm">
                <p className="truncate text-muted-foreground">{login.email}</p>
                <div className="flex flex-wrap gap-1.5">
                  {login.hasPassword && (
                    <Badge variant="muted">
                      <KeyRound />
                      Password
                    </Badge>
                  )}
                  {login.googleLinked && (
                    <Badge variant="info">
                      Google{login.googleEmail ? ` · ${login.googleEmail}` : ''}
                    </Badge>
                  )}
                  {login.awaitingFirstGoogleSignIn && (
                    <Badge variant="warning">Google · not signed in yet</Badge>
                  )}
                </div>
                {canManage && login.googleLinked && (
                  <div className="flex items-center gap-2 pt-1">
                    <TooltipButton
                      tooltip="Reset Google sign-in (they changed their Google account)"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmOpen(true)}
                      disabled={reset.isPending}
                    >
                      <RotateCcw className="size-3.5" />
                      Reset Google
                    </TooltipButton>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="muted">
              <ShieldOff />
              No login
            </Badge>
            <p className="text-sm text-muted-foreground">
              This person cannot sign in to the portal.
              {canManage && ' Turn on access from Edit.'}
            </p>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reset Google sign-in?"
        description={
          login?.hasPassword
            ? 'Their Google account is unlinked. They can still sign in with their password and link Google again.'
            : 'Their Google account is unlinked. Their next "Continue with Google" with their login email links it again.'
        }
        confirmLabel="Reset"
        destructive
        isLoading={reset.isPending}
        onConfirm={() =>
          reset.mutate(employee.id, { onSettled: () => setConfirmOpen(false) })
        }
      />
    </Card>
  )
}
