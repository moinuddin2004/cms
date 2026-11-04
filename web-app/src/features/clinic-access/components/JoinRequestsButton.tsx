import { useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  EmptyState,
  ErrorState,
  FieldWrapper,
  FormSheet,
  LoadingSkeleton,
  fieldError,
} from '@/components/shared'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/datetime'
import { useEmploymentRoles } from '@/features/employees'
import {
  useApproveJoinRequestForm,
  usePendingJoinRequests,
  useRejectJoinRequest,
} from '../hooks/useJoinRequests'
import type { JoinRequest } from '../types'

/**
 * Employees header: "Join requests (n)" — people who signed in with Google
 * from the clinic's Workspace domain and asked to join. Hidden when none.
 */
export function JoinRequestsButton() {
  const query = usePendingJoinRequests()
  const [open, setOpen] = useState(false)
  const count = query.data?.length ?? 0
  if (!count && !open) return null

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5" />
        Join requests
        <Badge variant="warning" className="ml-1 px-1.5">
          {count}
        </Badge>
      </Button>
      <JoinRequestsSheet open={open} onOpenChange={setOpen} />
    </>
  )
}

function JoinRequestsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const query = usePendingJoinRequests()
  const reject = useRejectJoinRequest()
  const [approving, setApproving] = useState<JoinRequest | null>(null)
  const [declining, setDeclining] = useState<JoinRequest | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-[17px] font-bold">
            Join requests
          </SheetTitle>
          <SheetDescription className="text-[13px] text-text-3">
            Approving adds the person as an employee at this location with the
            role you choose.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {query.isLoading ? (
            <LoadingSkeleton variant="table" />
          ) : query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : !query.data?.length ? (
            <EmptyState
              icon={UserPlus}
              title="No pending requests"
              description="People who ask to join with Google appear here."
            />
          ) : (
            <ul className="space-y-3">
              {query.data.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.name}</p>
                      <p className="text-sm text-text-3">
                        {r.email} · {r.phone}
                      </p>
                      <p className="text-xs text-text-3">
                        Asked {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeclining(r)}
                      >
                        <X className="size-3.5" />
                        Decline
                      </Button>
                      <Button size="sm" onClick={() => setApproving(r)}>
                        <Check className="size-3.5" />
                        Approve
                      </Button>
                    </div>
                  </div>
                  {r.message && (
                    <p className="mt-3 rounded-md bg-panel-2 px-3 py-2 text-sm text-text-2">
                      {r.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>

      <ApproveSheet request={approving} onClose={() => setApproving(null)} />

      <ConfirmDialog
        open={!!declining}
        onOpenChange={(o) => !o && setDeclining(null)}
        title="Decline this request?"
        description={
          declining
            ? `${declining.name} won't get access. They can still be added later from Employees.`
            : ''
        }
        confirmLabel="Decline"
        destructive
        isLoading={reject.isPending}
        onConfirm={() =>
          declining &&
          reject.mutate(
            { id: declining.id },
            { onSettled: () => setDeclining(null) },
          )
        }
      />
    </Sheet>
  )
}

function ApproveSheet({
  request,
  onClose,
}: {
  request: JoinRequest | null
  onClose: () => void
}) {
  const roles = useEmploymentRoles()
  const { form, globalError, setGlobalError } = useApproveJoinRequestForm(
    request?.id ?? null,
    onClose,
  )

  return (
    <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <FormSheet
          open={!!request}
          onOpenChange={(o) => {
            if (!o) {
              form.reset()
              setGlobalError('')
              onClose()
            }
          }}
          title={request ? `Approve ${request.name}` : 'Approve'}
          description="They become an employee at this location and sign in with Google."
          submitLabel="Approve"
          isSubmitting={isSubmitting}
          submitDisabled={!canSubmit || isSubmitting}
          onSubmit={() => void form.handleSubmit()}
        >
          <div className="space-y-4">
            <form.Field name="designation">
              {(field) => (
                <FieldWrapper
                  label="Job title"
                  htmlFor="jr-designation"
                  required
                  error={fieldError(field)}
                >
                  <Input
                    id="jr-designation"
                    placeholder="e.g. Receptionist"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={!!fieldError(field)}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="employmentRoleId">
              {(field) => (
                <FieldWrapper
                  label="Role"
                  error={fieldError(field)}
                  hint="Decides what they can see and do. You can change it later."
                >
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger aria-label="Role">
                      <SelectValue
                        placeholder={
                          roles.isLoading ? 'Loading roles…' : 'Select a role'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles.data ?? []).map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldWrapper>
              )}
            </form.Field>
            {globalError && (
              <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
                {globalError}
              </div>
            )}
          </div>
        </FormSheet>
      )}
    </form.Subscribe>
  )
}
