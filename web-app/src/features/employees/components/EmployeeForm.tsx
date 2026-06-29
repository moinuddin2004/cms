import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import {
  type EmployeeFormData,
  type Employee,
  GENDER_OPTIONS,
  EmploymentType,
  EMPLOYMENT_TYPE_OPTIONS,
} from '../types'

interface EmployeeFormProps {
  mode: 'create' | 'edit'
  defaultValues?: Employee | null
  onSubmit: (data: EmployeeFormData) => Promise<void>
  isPending: boolean
  onCancel: () => void
}

export function EmployeeForm({
  mode,
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
}: EmployeeFormProps) {
  const { activeLocationId } = useAuthStore()

  const { data: roles } = useQuery({
    queryKey: ['employment-roles'],
    queryFn: () => apiClient.get('/employment-roles').then((r) => r.data.data),
  })

  const form = useForm({
    defaultValues: {
      fullName: '',
      phone: '',
      cnic: '',
      designation: '',
      employmentRoleId: '',
      employmentType: EmploymentType.FULL_TIME as string,
      joiningDate: new Date().toISOString().split('T')[0],
      primaryLocationId: activeLocationId || '',
      gender: '' as string,
      dob: '',
      hasPortalAccess: false,
      profilePictureUrl: '',
      userId: '',
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value as EmployeeFormData)
    },
  })

  useEffect(() => {
    if (mode === 'edit' && defaultValues) {
      form.setFieldValue('fullName', defaultValues.fullName)
      form.setFieldValue('phone', defaultValues.phone)
      form.setFieldValue('cnic', defaultValues.cnic || '')
      form.setFieldValue('designation', defaultValues.designation)
      form.setFieldValue('employmentRoleId', defaultValues.employmentRoleId || '')
      form.setFieldValue('employmentType', defaultValues.employmentType)
      form.setFieldValue('joiningDate', defaultValues.joiningDate?.split('T')[0] || '')
      form.setFieldValue(
        'primaryLocationId',
        defaultValues.primaryLocationId || activeLocationId || '',
      )
      form.setFieldValue('gender', defaultValues.gender || '')
      form.setFieldValue(
        'dob',
        defaultValues.dob ? defaultValues.dob.split('T')[0] : '',
      )
      form.setFieldValue('hasPortalAccess', defaultValues.hasPortalAccess)
      form.setFieldValue('profilePictureUrl', defaultValues.profilePictureUrl || '')
      form.setFieldValue('userId', defaultValues.userId || '')
    }
  }, [defaultValues, mode, activeLocationId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Employee Information' : 'Update Employee Information'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form.Field name="fullName">
              {(field) => (
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="e.g., Dr. Ali Hassan"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="phone">
              {(field) => (
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    placeholder="e.g., +92 300 1234567"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="cnic">
              {(field) => (
                <div className="space-y-2">
                  <Label>CNIC (optional)</Label>
                  <Input
                    placeholder="e.g., 42101-1234567-1"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="designation">
              {(field) => (
                <div className="space-y-2">
                  <Label>Designation *</Label>
                  <Input
                    placeholder="e.g., Dentist"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="employmentRoleId">
              {(field) => (
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((role: any) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="employmentType">
              {(field) => (
                <div className="space-y-2">
                  <Label>Employment Type *</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="joiningDate">
              {(field) => (
                <div className="space-y-2">
                  <Label>Joining Date *</Label>
                  <Input
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="gender">
              {(field) => (
                <div className="space-y-2">
                  <Label>Gender (optional)</Label>
                  <Select
                    value={field.state.value || ''}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="dob">
              {(field) => (
                <div className="space-y-2">
                  <Label>Date of Birth (optional)</Label>
                  <Input
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="hasPortalAccess">
            {(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Portal Access</Label>
                  <div className="text-sm text-muted-foreground">
                    Enable portal access (can login to system)
                  </div>
                </div>
                <Switch
                  checked={field.state.value as boolean}
                  onCheckedChange={(val) => field.handleChange(val)}
                />
              </div>
            )}
          </form.Field>

          <div className="flex justify-end gap-4 border-t pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === 'create' ? 'Create Employee' : 'Update Employee'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
