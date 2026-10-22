import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/shared'
import { PERMISSIONS } from '@/features/access/generated/catalog'
import type { Permission } from '@/features/access/generated/catalog'
import { riskReasonSchema } from '../schemas/roles.schema'

/** Confirm granting high-risk permissions; a reason is required (audit). */
export function RiskReasonDialog({
  permissions,
  onConfirm,
  onCancel,
}: {
  /** Pending high-risk grants; empty / null = closed. */
  permissions: Permission[] | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const open = !!permissions?.length
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setTouched(false)
    }
  }, [open])

  const parsed = riskReasonSchema.safeParse(reason)
  const error =
    touched && !parsed.success ? parsed.error.issues[0]?.message : undefined

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-danger" /> Grant high-risk
            access?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Everyone with this role will be able to:{' '}
            {(permissions ?? []).map((p) => PERMISSIONS[p].label).join(', ')}.
            The reason is saved in the audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldWrapper
          label="Reason"
          htmlFor="risk-reason"
          required
          error={error}
        >
          <Textarea
            id="risk-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            placeholder="e.g. Accountant covers refunds while the manager is away"
          />
        </FieldWrapper>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!parsed.success}
            onClick={() => onConfirm(reason)}
          >
            Grant access
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
