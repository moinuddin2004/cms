import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import type { User, UserRoleType } from '../types'
import { useCreateUser, useStaffCandidates, useUpdateUser } from '../api'
import { useAuthStore } from '@/store/useAuthStore'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
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
  const { isSuperAdmin, activeOrganizationId } = useAuthStore()
  const createMutation = useCreateUser(activeOrganizationId || undefined)
  const updateMutation = useUpdateUser(activeOrganizationId || undefined)

  const isEditing = !!user

  // Local state for watched values used in conditional rendering
  const [selectedType, setSelectedType] = useState<string>(activeTab)

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      type: activeTab as string,
      status: 'active',
      organizationId: '',
      employeeId: '',
    },
    onSubmit: async ({ value }) => {
      if (isEditing && user) {
        updateMutation.mutate(
          {
            id: user.uuid,
            payload: {
              name: value.name,
              email: value.email,
              ...(value.password ? { password: value.password } : {}),
              status: value.status,
              type: value.type as UserRoleType,
            },
          },
          {
            onSuccess: () => {
              onOpenChange(false)
              form.reset()
            },
          },
        )
      } else {
        createMutation.mutate(
          {
            name: value.name,
            email: value.email,
            password: value.password,
            type: value.type as UserRoleType,
            ...(value.type === 'employee'
              ? { employeeId: value.employeeId }
              : {}),
            ...(value.organizationId
              ? { organizationId: value.organizationId }
              : {}),
          },
          {
            onSuccess: () => {
              onOpenChange(false)
              form.reset()
            },
          },
        )
      }
    },
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

  useEffect(() => {
    if (open) {
      if (user) {
        const type =
          user.globalRole === 'super_admin' ? 'super_admin' : activeTab
        form.setFieldValue('name', user.name || '')
        form.setFieldValue('email', user.email || '')
        form.setFieldValue('status', user.status || 'active')
        form.setFieldValue('type', type)
        setSelectedType(type)
      } else {
        form.reset()
        form.setFieldValue('type', activeTab)
        setSelectedType(activeTab)
      }
    }
  }, [open, user, activeTab])

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit User' : 'Create User'}</DialogTitle>
        </DialogHeader>
        <form
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
                  required
                />
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
                  required
                />
              </div>
            )}
          </form.Field>

          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) => {
                    field.handleChange(val)
                    setSelectedType(val)
                  }}
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
            <form.Field
              name="employeeId"
              validators={{
                onSubmit: ({ value }) =>
                  value ? undefined : 'Choose the employee',
              }}
            >
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
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
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
                </div>
              )}
            </form.Field>
          )}

          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label>
                  Password {isEditing && '(Leave blank to keep current)'}
                </Label>
                <Input
                  type="password"
                  placeholder={isEditing ? '******' : 'Enter a strong password'}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

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
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
