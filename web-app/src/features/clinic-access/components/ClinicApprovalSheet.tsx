import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { FieldWrapper, FormSheet, fieldError } from '@/components/shared'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/features/auth'
import { decideClinicApproval } from '../services/clinic-access.api'
import { clinicApprovalSchema } from '../schemas/clinic-access.schema'
import type { ClinicApprovalFormValues } from '../schemas/clinic-access.schema'
import type { ApprovalStatus } from '../types'

export interface ApprovalTarget {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  createdAt: string
  status: ApprovalStatus
  note: string | null
}

/** Super admin: approve or reject a self-signup clinic. */
export function ClinicApprovalSheet({
  clinic,
  onClose,
}: {
  clinic: ApprovalTarget | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [globalError, setGlobalError] = useState('')
  const defaultValues: ClinicApprovalFormValues = {
    decision: 'approve',
    note: '',
  }
  const form = useForm({
    defaultValues,
    validators: {
      onChange: clinicApprovalSchema,
      onSubmit: clinicApprovalSchema,
    },
    onSubmit: async ({ value }) => {
      if (!clinic) return
      setGlobalError('')
      try {
        await decideClinicApproval(clinic.id, {
          decision: value.decision,
          note: value.decision === 'reject' ? value.note.trim() : undefined,
        })
        toast.success(
          value.decision === 'approve'
            ? `${clinic.name} approved`
            : `${clinic.name} rejected`,
        )
        await qc.invalidateQueries({ queryKey: ['admin-subscriptions'] })
        onClose()
      } catch (err) {
        setGlobalError(apiErrorMessage(err, 'Could not save. Try again.'))
      }
    },
  })

  // Start fresh for each clinic.
  useEffect(() => {
    if (clinic) {
      form.reset({
        decision: clinic.status === 'approved' ? 'reject' : 'approve',
        note: clinic.note ?? '',
      })
      setGlobalError('')
    }
  }, [clinic, form])

  return (
    <form.Subscribe
      selector={(s) =>
        [s.canSubmit, s.isSubmitting, s.values.decision] as const
      }
    >
      {([canSubmit, isSubmitting, decision]) => (
        <FormSheet
          open={!!clinic}
          onOpenChange={(o) => !o && onClose()}
          title={clinic ? `Review ${clinic.name}` : 'Review clinic'}
          description="Until a clinic is approved, nobody can use it."
          submitLabel={
            decision === 'approve' ? 'Approve clinic' : 'Reject clinic'
          }
          isSubmitting={isSubmitting}
          submitDisabled={!canSubmit || isSubmitting}
          onSubmit={() => void form.handleSubmit()}
        >
          {clinic && (
            <div className="space-y-5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border bg-panel-2 p-4 text-sm">
                <dt className="text-text-3">Email</dt>
                <dd className="truncate">{clinic.email || '—'}</dd>
                <dt className="text-text-3">Phone</dt>
                <dd>{clinic.phone || '—'}</dd>
                <dt className="text-text-3">Signed up</dt>
                <dd>{formatDate(clinic.createdAt)}</dd>
              </dl>

              <form.Field name="decision">
                {(field) => (
                  <div
                    role="radiogroup"
                    aria-label="Decision"
                    className="grid grid-cols-2 gap-2"
                  >
                    {(['approve', 'reject'] as const).map((d) => {
                      const Icon = d === 'approve' ? Check : X
                      const active = field.state.value === d
                      return (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => field.handleChange(d)}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                            active
                              ? d === 'approve'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-danger bg-danger-soft text-danger'
                              : 'border-border text-text-2 hover:bg-accent',
                          )}
                        >
                          <Icon className="size-4" />
                          {d === 'approve' ? 'Approve' : 'Reject'}
                        </button>
                      )
                    })}
                  </div>
                )}
              </form.Field>

              {decision === 'reject' && (
                <form.Field name="note">
                  {(field) => (
                    <FieldWrapper
                      label="Reason"
                      htmlFor="approval-note"
                      required
                      error={fieldError(field)}
                      hint="The owner sees this when they sign in."
                    >
                      <Textarea
                        id="approval-note"
                        rows={4}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={!!fieldError(field)}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              )}

              {globalError && (
                <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
                  {globalError}
                </div>
              )}
            </div>
          )}
        </FormSheet>
      )}
    </form.Subscribe>
  )
}
