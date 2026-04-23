import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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
  employeeFormSchema,
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

  // Fetch roles for the select dropdown
  const { data: roles } = useQuery({
    queryKey: ['employment-roles'],
    queryFn: () => apiClient.get('/employment-roles').then((r) => r.data.data),
  })

  const form = useForm<EmployeeFormData, any, EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      cnic: '',
      designation: '',
      employmentRoleId: '',
      employmentType: EmploymentType.FULL_TIME,
      joiningDate: new Date().toISOString().split('T')[0],
      primaryLocationId: activeLocationId || '',
      hasPortalAccess: false,
      profilePictureUrl: '',
      userId: '',
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && defaultValues) {
      form.reset({
        fullName: defaultValues.fullName,
        phone: defaultValues.phone,
        cnic: defaultValues.cnic || '',
        designation: defaultValues.designation,
        employmentRoleId: defaultValues.employmentRoleId || '',
        employmentType: defaultValues.employmentType,
        joiningDate: defaultValues.joiningDate?.split('T')[0] || '',
        primaryLocationId: defaultValues.primaryLocationId || activeLocationId || '',
        gender: defaultValues.gender || undefined,
        dob: defaultValues.dob ? defaultValues.dob.split('T')[0] : '',
        hasPortalAccess: defaultValues.hasPortalAccess,
        profilePictureUrl: defaultValues.profilePictureUrl || '',
        userId: defaultValues.userId || '',
      })
    }
  }, [defaultValues, mode, form, activeLocationId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Employee Information' : 'Update Employee Information'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Dr. Ali Hassan"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., +92 300 1234567"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cnic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNIC (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 42101-1234567-1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Dentist" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employmentRoleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="joiningDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender (optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="hasPortalAccess"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Portal Access
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable portal access (can login to system)
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
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
        </Form>
      </CardContent>
    </Card>
  )
}
