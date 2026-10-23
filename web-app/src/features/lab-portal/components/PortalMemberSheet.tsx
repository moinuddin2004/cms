import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { usePortalMemberForm } from '../hooks/usePortalMemberForm'
import { LAB_ROLE_LABEL } from '../types'
import type { LabMemberRole } from '../types'

const ROLE_OPTIONS = (Object.keys(LAB_ROLE_LABEL) as LabMemberRole[]).map(
  (r) => ({ value: r, label: LAB_ROLE_LABEL[r] }),
)

/** A lab admin adds an existing account to the lab's team. */
export function PortalMemberSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const form = usePortalMemberForm({
    open,
    onDone: () => onOpenChange(false),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Add team member"
      description="The person needs their own account — clinic staff accounts can’t join an outside lab."
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Add member
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
          void form.handleSubmit()
        }}
      >
        <form.Field name="email">
          {(f) => (
            <FieldWrapper
              label="Account email"
              htmlFor="portal-member-email"
              required
              error={fieldError(f)}
            >
              <Input
                id="portal-member-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="role">
          {(f) => (
            <FormSelect
              label="Role"
              required
              value={f.state.value}
              onValueChange={(v) => f.handleChange(v as LabMemberRole)}
              options={ROLE_OPTIONS}
              hint={
                f.state.value === 'lab_admin'
                  ? 'Accepts clinics and orders, and manages the team.'
                  : 'Works on the cases assigned to them.'
              }
            />
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
