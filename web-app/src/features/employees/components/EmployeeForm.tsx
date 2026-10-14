import { useState } from 'react'
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
} from '@/components/shared/SearchableSelect'
import { Switch } from '@/components/ui/switch'
import { DatePicker } from '@/components/shared/DatePicker'
import { format } from 'date-fns'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import {
  type EmployeeFormData,
  type Employee,
  GENDER_OPTIONS,
  EmploymentType,
  EMPLOYMENT_TYPE_OPTIONS,
  employeeFormSchema,
} from '../types'

interface EmployeeFormProps {
  mode: 'create' | 'edit'
  defaultValues?: Employee | null
  onSubmit: (data: EmployeeFormData) => Promise<void>
  isPending: boolean
  onCancel: () => void
  serverError?: string | null
  variant?: 'card' | 'sheet'
}

// Helper to clear a single key from errors
function clearError(
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  key: string,
) {
  setErrors((prev) => {
    if (!prev[key]) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })
}

export function EmployeeForm({
  mode,
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  serverError,
  variant = 'card',
}: EmployeeFormProps) {
  const { activeLocationId } = useAuthStore()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { data: roles } = useQuery({
    queryKey: ['employment-roles'],
    queryFn: () => apiClient.get('/employment-roles').then((r) => r.data.data),
  })

  const initial = defaultValues
    ? {
        fullName: defaultValues.fullName ?? '',
        phone: defaultValues.phone ?? '',
        cnic: defaultValues.cnic ?? '',
        designation: defaultValues.designation ?? '',
        employmentRoleId: defaultValues.employmentRoleId ?? '',
        employmentType: defaultValues.employmentType ?? EmploymentType.FULL_TIME,
        joiningDate: defaultValues.joiningDate?.split('T')[0] ?? '',
        primaryLocationId: defaultValues.primaryLocationId ?? activeLocationId ?? '',
        gender: (defaultValues.gender ?? '') as string,
        dob: defaultValues.dob ? defaultValues.dob.split('T')[0] : '',
        hasPortalAccess: defaultValues.hasPortalAccess ?? false,
        portalEmail: '',
        portalPassword: '',
        profilePictureUrl: defaultValues.profilePictureUrl ?? '',
        userId: defaultValues.userId ?? '',
        grossSalary: undefined as string | number | undefined,
      }
    : {
        fullName: '',
        phone: '',
        cnic: '',
        designation: '',
        employmentRoleId: '',
        employmentType: EmploymentType.FULL_TIME as string,
        joiningDate: new Date().toISOString().split('T')[0],
        primaryLocationId: activeLocationId ?? '',
        gender: '' as string,
        dob: '',
        hasPortalAccess: false,
        portalEmail: '',
        portalPassword: '',
        profilePictureUrl: '',
        userId: '',
        grossSalary: undefined as string | number | undefined,
      }

  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      const result = employeeFormSchema.safeParse(value)
      if (!result.success) {
        const errors: Record<string, string> = {}
        result.error.issues.forEach((e) => {
          const key = String(e.path[0])
          if (!errors[key]) errors[key] = e.message
        })
        setFieldErrors(errors)
        return
      }
      setFieldErrors({})
      await onSubmit(result.data as EmployeeFormData)
    },
  })

  const hasErrors = Object.keys(fieldErrors).length > 0

  const formContent = (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-6"
        >
          {/* Server / submission error banner */}
          {serverError && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Client validation summary (shown after failed submit) */}
          {hasErrors && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>Please fix the errors below before submitting.</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Full Name */}
            <form.Field name="fullName">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., Dr. Ali Hassan"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      clearError(setFieldErrors, 'fullName')
                    }}
                    onBlur={field.handleBlur}
                    className={fieldErrors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {fieldErrors.fullName && (
                    <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Phone */}
            <form.Field name="phone">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., +92 300 1234567"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      clearError(setFieldErrors, 'phone')
                    }}
                    onBlur={field.handleBlur}
                    className={fieldErrors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                  )}
                </div>
              )}
            </form.Field>

            {/* CNIC */}
            <form.Field name="cnic">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>CNIC <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    placeholder="e.g., 42101-1234567-1"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>

            {/* Designation */}
            <form.Field name="designation">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Designation <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., Dentist"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                      clearError(setFieldErrors, 'designation')
                    }}
                    onBlur={field.handleBlur}
                    className={fieldErrors.designation ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {fieldErrors.designation && (
                    <p className="text-xs text-destructive">{fieldErrors.designation}</p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Role */}
            <form.Field name="employmentRoleId">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Role <span className="text-destructive">*</span></Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => {
                      field.handleChange(val)
                      clearError(setFieldErrors, 'employmentRoleId')
                    }}
                  >
                    <SelectTrigger className={fieldErrors.employmentRoleId ? 'border-destructive focus-visible:ring-destructive' : ''}>
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
                  {fieldErrors.employmentRoleId && (
                    <p className="text-xs text-destructive">{fieldErrors.employmentRoleId}</p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Employment Type */}
            <form.Field name="employmentType">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Employment Type <span className="text-destructive">*</span></Label>
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

            {/* Joining Date */}
            <form.Field name="joiningDate">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Joining Date <span className="text-destructive">*</span></Label>
                  <DatePicker
                    value={field.state.value}
                    onChange={(v) => {
                      field.handleChange(v)
                      clearError(setFieldErrors, 'joiningDate')
                    }}
                    placeholder="Select joining date"
                    className={fieldErrors.joiningDate ? 'border-destructive' : ''}
                  />
                  {fieldErrors.joiningDate && (
                    <p className="text-xs text-destructive">{fieldErrors.joiningDate}</p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Gender */}
            <form.Field name="gender">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Gender <span className="text-muted-foreground text-xs">(optional)</span></Label>
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

            {/* Date of Birth */}
            <form.Field name="dob">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Date of Birth <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <DatePicker
                    value={field.state.value}
                    onChange={field.handleChange}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    placeholder="Select date of birth"
                    withYearDropdown
                    clearable
                  />
                </div>
              )}
            </form.Field>

            {/* Gross Salary */}
            <form.Field name="grossSalary">
              {(field) => (
                <div className="space-y-1.5">
                  <Label>Gross Salary <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g., 50000"
                    value={field.state.value ?? ''}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value === '' ? undefined : e.target.value,
                      )
                    }
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>
          </div>

          {/* Portal Access */}
          <form.Field name="hasPortalAccess">
            {(field) => (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Portal Access</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow this employee to log in to the system
                    </p>
                  </div>
                  <Switch
                    checked={field.state.value as boolean}
                    onCheckedChange={(val) => {
                      field.handleChange(val)
                      // Clear portal errors when toggled off
                      if (!val) {
                        setFieldErrors((prev) => {
                          const next = { ...prev }
                          delete next.portalEmail
                          delete next.portalPassword
                          return next
                        })
                      }
                    }}
                  />
                </div>

                {/* Portal credentials — only shown when enabled and no user linked yet */}
                {field.state.value && !form.getFieldValue('userId') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                    <form.Field name="portalEmail">
                      {(emailField) => (
                        <div className="space-y-1.5">
                          <Label>Login Email <span className="text-destructive">*</span></Label>
                          <Input
                            type="email"
                            placeholder="e.g., ali@clinic.com"
                            value={emailField.state.value as string}
                            onChange={(e) => {
                              emailField.handleChange(e.target.value)
                              clearError(setFieldErrors, 'portalEmail')
                            }}
                            onBlur={emailField.handleBlur}
                            className={fieldErrors.portalEmail ? 'border-destructive focus-visible:ring-destructive' : ''}
                          />
                          {fieldErrors.portalEmail && (
                            <p className="text-xs text-destructive">{fieldErrors.portalEmail}</p>
                          )}
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="portalPassword">
                      {(pwField) => (
                        <div className="space-y-1.5">
                          <Label>Password <span className="text-destructive">*</span></Label>
                          <Input
                            type="password"
                            placeholder="Min. 6 characters"
                            value={pwField.state.value as string}
                            onChange={(e) => {
                              pwField.handleChange(e.target.value)
                              clearError(setFieldErrors, 'portalPassword')
                            }}
                            onBlur={pwField.handleBlur}
                            className={fieldErrors.portalPassword ? 'border-destructive focus-visible:ring-destructive' : ''}
                          />
                          {fieldErrors.portalPassword && (
                            <p className="text-xs text-destructive">{fieldErrors.portalPassword}</p>
                          )}
                        </div>
                      )}
                    </form.Field>
                  </div>
                )}

                {/* Already linked user badge */}
                {field.state.value && form.getFieldValue('userId') && (
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    Portal user already linked — credentials cannot be changed here.
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Employee' : 'Update Employee'}
            </Button>
          </div>
        </form>
  )

  if (variant === 'sheet') {
    return formContent
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Employee Information' : 'Update Employee Information'}
        </CardTitle>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  )
}
