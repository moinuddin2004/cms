import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useCreateRoleForm } from '../hooks/useRoleForm'
import { toastRoleError } from '../lib/role-errors'
import type { RoleDetail } from '../types/roles.types'

/** Create a custom role; permissions are set on its page afterwards. */
export function RoleSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (role: RoleDetail) => void
}) {
  const { form } = useCreateRoleForm({
    open,
    onDone: (role) => {
      onOpenChange(false)
      onCreated(role)
    },
  })

  const submit = () => void form.handleSubmit().catch(toastRoleError)

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="New role"
      description="Start empty, then pick a level per module on the role's page. To start from an existing role, clone it instead."
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
                Create role
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
              label="Name"
              htmlFor="role-name"
              required
              error={fieldError(f)}
            >
              <Input
                id="role-name"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                placeholder="e.g. Hygienist"
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="description">
          {(f) => (
            <FieldWrapper
              label="Description"
              htmlFor="role-description"
              error={fieldError(f)}
            >
              <Textarea
                id="role-description"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
                rows={3}
                placeholder="What people in this role do"
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
