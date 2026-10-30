import { useForm } from '@tanstack/react-form'
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
import { fieldError } from '@/components/forms/fieldError'
import { PERMISSIONS } from '@/features/access/generated/catalog'
import type { Permission } from '@/features/access/generated/catalog'
import { riskReasonFormSchema } from '../schemas/roles.schema'

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

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        {/* Mounted per open, so the form starts fresh each time. */}
        {open && (
          <RiskReasonForm permissions={permissions} onConfirm={onConfirm} />
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RiskReasonForm({
  permissions,
  onConfirm,
}: {
  permissions: Permission[]
  onConfirm: (reason: string) => void
}) {
  const form = useForm({
    defaultValues: { reason: '' },
    // onMount keeps "Grant access" disabled until a valid reason is typed.
    validators: {
      onMount: riskReasonFormSchema,
      onChange: riskReasonFormSchema,
      onSubmit: riskReasonFormSchema,
    },
    onSubmit: ({ value }) => onConfirm(value.reason),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-4"
    >
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-danger" /> Grant high-risk access?
        </AlertDialogTitle>
        <AlertDialogDescription>
          Everyone with this role will be able to:{' '}
          {permissions.map((p) => PERMISSIONS[p].label).join(', ')}. The reason
          is saved in the audit log.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <form.Field name="reason">
        {(field) => (
          <FieldWrapper
            label="Reason"
            htmlFor="risk-reason"
            required
            error={fieldError(field)}
          >
            <Textarea
              id="risk-reason"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              rows={3}
              placeholder="e.g. Accountant covers refunds while the manager is away"
            />
          </FieldWrapper>
        )}
      </form.Field>
      <AlertDialogFooter>
        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              variant="destructive"
              disabled={!canSubmit || isSubmitting}
            >
              Grant access
            </Button>
          )}
        </form.Subscribe>
      </AlertDialogFooter>
    </form>
  )
}
