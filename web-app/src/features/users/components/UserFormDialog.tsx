import type { User, UserRoleType } from '../types'
import { cn } from '@/lib/utils'
import { useStaffCandidates } from '../api'
import { useUserForm } from '../hooks/useUserForm'
import { useAuthStore } from '@/store/useAuthStore'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { fieldError } from '@/components/forms/fieldError'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Loader2 } from 'lucide-react'

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  activeTab: UserRoleType
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  activeTab,
}: UserFormDialogProps) {
  const { activeOrganizationId } = useAuthStore()
  const { form, isEditing, isPending, selectedType, isSuperAdmin } =
    useUserForm({
      open,
      user,
      activeTab,
      onDone: () => onOpenChange(false),
    })

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await apiClient.get('/organizations')
      return res.data.data as { id: string; name: string }[]
    },
    enabled: isSuperAdmin && selectedType === 'owner',
  })

  const isStaff = selectedType === 'employee' && !isEditing
  const { data: candidates, isLoading: candidatesLoading } = useStaffCandidates(
    activeOrganizationId || undefined,
    open && isStaff,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit User' : 'Create User'}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 mt-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="John Doe"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={!!fieldError(field)}
                />
                {fieldError(field) && (
                  <p className="text-xs text-destructive">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={!!fieldError(field)}
                />
                {fieldError(field) && (
                  <p className="text-xs text-destructive">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) => field.handleChange(val)}
                  disabled={isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && (
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="employee">
                      Staff (existing employee)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {field.state.value === 'employee' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Gives an employee a login. What they can do comes from their
                    role in the Employee directory.
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {isStaff && (
            <form.Field name="employeeId">
              {(field) => (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => {
                      field.handleChange(val)
                      const picked = candidates?.find(
                        (c) => c.employeeId === val,
                      )
                      if (picked && !form.getFieldValue('name')) {
                        form.setFieldValue('name', picked.name)
                      }
                    }}
                    disabled={candidatesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          candidatesLoading
                            ? 'Loading employees…'
                            : 'Select an employee without a login'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates?.map((c) => (
                        <SelectItem key={c.employeeId} value={c.employeeId}>
                          {c.name}
                          {c.locations.length
                            ? ` · ${c.locations.join(', ')}`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!candidatesLoading && candidates?.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Every employee already has a login. Add new staff from the
                      Employee directory first.
                    </p>
                  )}
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          )}

          {isSuperAdmin && selectedType === 'owner' && !isEditing && (
            <form.Field name="organizationId">
              {(field) => (
                <div className="space-y-2">
                  <Label>Organization (Required for Owners)</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgsData?.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          )}

          {!isEditing && (
            <form.Subscribe selector={(s) => s.values.type}>
              {(type) =>
                type === 'super_admin' ? null : (
                  <form.Field name="loginMethod">
                    {(field) => (
                      <div className="space-y-2">
                        <Label id="login-method-label">Signs in with</Label>
                        <div
                          role="radiogroup"
                          aria-labelledby="login-method-label"
                          className="grid grid-cols-2 gap-2"
                        >
                          {(
                            [
                              ['password', 'Email & password'],
                              ['google', 'Google account'],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={field.state.value === value}
                              onClick={() => field.handleChange(value)}
                              className={cn(
                                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                                field.state.value === value
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-text-2 hover:bg-accent',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {field.state.value === 'google'
                            ? 'They use "Continue with Google" with this email — no password.'
                            : 'An email that already has an account (another clinic) is reused with its own password.'}
                        </p>
                      </div>
                    )}
                  </form.Field>
                )
              }
            </form.Subscribe>
          )}

          <form.Subscribe
            selector={(s) =>
              !isEditing &&
              s.values.loginMethod === 'google' &&
              s.values.type !== 'super_admin'
            }
          >
            {(googleOnly) =>
              googleOnly ? null : (
                <form.Field name="password">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>
                        Password {isEditing && '(Leave blank to keep current)'}
                      </Label>
                      <Input
                        type="password"
                        placeholder={
                          isEditing ? '******' : 'Enter a strong password'
                        }
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={!!fieldError(field)}
                      />
                      {fieldError(field) && (
                        <p className="text-xs text-destructive">
                          {fieldError(field)}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
              )
            }
          </form.Subscribe>

          {isEditing && (
            <form.Field name="status">
              {(field) => (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          )}

          <div className="flex justify-end pt-4 space-x-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || isPending}
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {isPending ? 'Saving...' : 'Save'}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
