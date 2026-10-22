import { Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, FormSheet } from '@/components/shared'
import { PERMISSIONS } from '@/features/access/generated/catalog'
import { fieldError } from '@/features/queue'
import { useCloneRoleForm } from '../hooks/useRoleForm'
import { toastRoleError } from '../lib/role-errors'
import type { RoleDetail, RoleSummary } from '../types/roles.types'

/** Copy a role (the way to customise a read-only system role). */
export function CloneRoleSheet({
  source,
  onOpenChange,
  onCloned,
}: {
  source: RoleSummary | null
  onOpenChange: (open: boolean) => void
  onCloned: (role: RoleDetail) => void
}) {
  const open = !!source
  const { form, needsReason, riskyPermissions } = useCloneRoleForm({
    open,
    source,
    onDone: (role) => {
      onOpenChange(false)
      onCloned(role)
    },
  })

  const submit = () => void form.handleSubmit().catch(toastRoleError)

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={source ? `Clone ${source.name}` : 'Clone role'}
      description="The copy gets the same permissions and home page, and you can edit it. Nobody is moved to the copy."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button onClick={submit} disabled={!canSubmit || isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Clone role
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <form.Field name="name">
          {(f) => (
            <FieldWrapper
              label="Name of the copy"
              htmlFor="clone-name"
              required
              error={fieldError(f)}
            >
              <Input
                id="clone-name"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>

        {needsReason && (
          <>
            <div className="flex gap-2 rounded-lg border border-border bg-danger-soft p-3 text-xs text-danger">
              <ShieldAlert className="size-4 shrink-0" />
              <p>
                This role has high-risk access:{' '}
                {riskyPermissions.map((p) => PERMISSIONS[p].label).join(', ')}.
                The reason is kept in the audit log.
              </p>
            </div>
            <form.Field name="reason">
              {(f) => (
                <FieldWrapper
                  label="Reason"
                  htmlFor="clone-reason"
                  required
                  error={fieldError(f)}
                >
                  <Textarea
                    id="clone-reason"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    rows={3}
                    placeholder="Why does this role need this access?"
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </>
        )}
      </form>
    </FormSheet>
  )
}
