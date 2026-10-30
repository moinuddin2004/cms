import { useAccess } from '@/features/access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
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
import { fieldError } from '@/components/forms/fieldError'
import { useEmployeeForm } from '../hooks/useEmployeeForm'
import { GENDER_OPTIONS, EMPLOYMENT_TYPE_OPTIONS } from '../types'
import type {
  EmployeeFormData,
  Employee,
  EmploymentType,
  Gender,
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

const ERROR_RING = 'border-destructive focus-visible:ring-destructive'

type PayType = 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION'

const PAY_TYPES: Array<{ value: PayType; label: string }> = [
  { value: 'SALARY', label: 'Salaried' },
  { value: 'COMMISSION', label: 'Commission' },
  { value: 'SALARY_PLUS_COMMISSION', label: 'Both' },
]

export function EmployeeForm({
  mode,
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  serverError,
  variant = 'card',
}: EmployeeFormProps) {
  // Pay terms need compensation.manage (it implies the commissions feature).
  const commissionsOn = useAccess().can('compensation.manage')

  const { data: roles } = useQuery({
    queryKey: ['employment-roles'],
    queryFn: () => apiClient.get('/employment-roles').then((r) => r.data.data),
  })

  const form = useEmployeeForm({ employee: defaultValues, onSubmit })

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
      <form.Subscribe
        selector={(s) => s.submissionAttempts > 0 && !s.canSubmit}
      >
        {(hasErrors) =>
          hasErrors && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>Please fix the errors below before submitting.</span>
            </div>
          )
        }
      </form.Subscribe>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Full Name */}
        <form.Field name="fullName">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., Dr. Ali Hassan"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={fieldError(field) ? ERROR_RING : ''}
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Phone */}
        <form.Field name="phone">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., +92 300 1234567"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={fieldError(field) ? ERROR_RING : ''}
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* CNIC */}
        <form.Field name="cnic">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                CNIC{' '}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                placeholder="e.g., 42101-1234567-1"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={fieldError(field) ? ERROR_RING : ''}
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Designation */}
        <form.Field name="designation">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                Designation <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g., Dentist"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={fieldError(field) ? ERROR_RING : ''}
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Role */}
        <form.Field name="employmentRoleId">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val)}
              >
                <SelectTrigger className={fieldError(field) ? ERROR_RING : ''}>
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
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Employment Type */}
        <form.Field name="employmentType">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                Employment Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(val) =>
                  field.handleChange(val as EmploymentType)
                }
              >
                <SelectTrigger className={fieldError(field) ? ERROR_RING : ''}>
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
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Joining Date */}
        <form.Field name="joiningDate">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                Joining Date <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                value={field.state.value}
                onChange={(v) => field.handleChange(v)}
                placeholder="Select joining date"
                className={fieldError(field) ? 'border-destructive' : ''}
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>

        {/* Gender */}
        <form.Field name="gender">
          {(field) => (
            <div className="space-y-1.5">
              <Label>
                Gender{' '}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Select
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as Gender | '')}
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
              <Label>
                Date of Birth{' '}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
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
              <Label>
                Gross Salary{' '}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g., 50000"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={fieldError(field) ? ERROR_RING : ''}
              />
              {fieldError(field) && (
                <p className="text-xs text-destructive">{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      {/* Compensation step (optional; default salaried) */}
      {mode === 'create' && commissionsOn && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="space-y-0.5">
            <Label className="text-base">Compensation</Label>
            <p className="text-sm text-muted-foreground">
              Salaried by default. Commission is a share of what patients pay
              for this doctor's work.
            </p>
          </div>
          <form.Field name="payType">
            {(field) => (
              <div
                className="flex overflow-hidden rounded-lg border text-sm"
                role="radiogroup"
                aria-label="Plan type"
              >
                {PAY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={field.state.value === t.value}
                    onClick={() => field.handleChange(t.value)}
                    className={cn(
                      'flex-1 px-3 py-2 transition-colors',
                      field.state.value === t.value
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.values.payType}>
            {(payType) =>
              payType !== 'SALARY' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <form.Field name="commissionRate">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label htmlFor="emp-commission-rate">
                          Default commission (%)
                        </Label>
                        <Input
                          id="emp-commission-rate"
                          inputMode="decimal"
                          placeholder="e.g. 40"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {fieldError(field) && (
                          <p className="text-sm text-destructive">
                            {fieldError(field)}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="commissionBasis">
                    {(field) => (
                      <div className="space-y-1.5">
                        <Label>Commission on</Label>
                        <div
                          className="flex overflow-hidden rounded-lg border text-sm"
                          role="radiogroup"
                          aria-label="Commission basis"
                        >
                          {(['NET', 'GROSS'] as const).map((b) => (
                            <button
                              key={b}
                              type="button"
                              role="radio"
                              aria-checked={field.state.value === b}
                              onClick={() => field.handleChange(b)}
                              className={cn(
                                'flex-1 px-3 py-2 transition-colors',
                                field.state.value === b
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted',
                              )}
                            >
                              {b === 'NET'
                                ? 'After discount'
                                : 'Before discount'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </form.Field>
                </div>
              )
            }
          </form.Subscribe>
        </div>
      )}

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
                checked={field.state.value}
                onCheckedChange={(val) => field.handleChange(val)}
              />
            </div>

            {/* Portal credentials — only shown when enabled and no user linked yet */}
            {field.state.value && !form.getFieldValue('userId') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <form.Field name="portalEmail">
                  {(emailField) => (
                    <div className="space-y-1.5">
                      <Label>
                        Login Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="email"
                        placeholder="e.g., ali@clinic.com"
                        value={emailField.state.value}
                        onChange={(e) =>
                          emailField.handleChange(e.target.value)
                        }
                        onBlur={emailField.handleBlur}
                        className={fieldError(emailField) ? ERROR_RING : ''}
                      />
                      {fieldError(emailField) && (
                        <p className="text-xs text-destructive">
                          {fieldError(emailField)}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="portalPassword">
                  {(pwField) => (
                    <div className="space-y-1.5">
                      <Label>
                        Password <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="password"
                        placeholder="Min. 6 characters"
                        value={pwField.state.value}
                        onChange={(e) => pwField.handleChange(e.target.value)}
                        onBlur={pwField.handleBlur}
                        className={fieldError(pwField) ? ERROR_RING : ''}
                      />
                      {fieldError(pwField) && (
                        <p className="text-xs text-destructive">
                          {fieldError(pwField)}
                        </p>
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
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={isPending || !canSubmit || isSubmitting}
            >
              {(isPending || isSubmitting) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === 'create' ? 'Create Employee' : 'Update Employee'}
            </Button>
          )}
        </form.Subscribe>
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
          {mode === 'create'
            ? 'Employee Information'
            : 'Update Employee Information'}
        </CardTitle>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  )
}
