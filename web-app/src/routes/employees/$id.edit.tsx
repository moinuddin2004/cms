import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEmployee, useUpdateEmployee } from '@/hooks/useEmployees'
import { toast } from 'sonner'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useEffect } from 'react'

const employeeSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  cnic: z.string().optional().nullable(),
  designation: z.string().min(2, 'Designation is required'),
  employmentRoleId: z.string().min(1, 'Role is required'),
  employmentType: z.enum(['full_time', 'part_time', 'visiting', 'contract']),
  joiningDate: z.string().min(1, 'Joining date is required'),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  dob: z.string().optional().nullable(),
  hasPortalAccess: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

type EmployeeFormValues = z.infer<typeof employeeSchema>

export const Route = createFileRoute('/employees/$id/edit')({
  component: EditEmployeePage,
})

function EditEmployeePage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: employee, isLoading: isEmployeeLoading } = useEmployee(id)
  const updateMutation = useUpdateEmployee(id)

  const { data: roles } = useQuery({
    queryKey: ['employment-roles'],
    queryFn: () => apiClient.get('/employment-roles').then((r) => r.data.data),
  })

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      cnic: '',
      designation: '',
      employmentRoleId: '',
      employmentType: 'full_time',
      joiningDate: '',
      hasPortalAccess: false,
      isActive: true,
    },
  })

  useEffect(() => {
    if (employee) {
      form.reset({
        fullName: employee.fullName,
        phone: employee.phone,
        cnic: employee.cnic || '',
        designation: employee.designation,
        employmentRoleId: employee.employmentRole?.id || '',
        employmentType: employee.employmentType,
        joiningDate: employee.joiningDate.split('T')[0],
        gender: employee.gender || null,
        dob: employee.dob ? employee.dob.split('T')[0] : null,
        hasPortalAccess: employee.hasPortalAccess,
        isActive: employee.isActive,
      })
    }
  }, [employee, form])

  async function onSubmit(data: EmployeeFormValues) {
    try {
      await updateMutation.mutateAsync(data)
      toast.success('Employee updated successfully')
      navigate({ to: `/employees/${id}` })
    } catch (error) {
      toast.error('Failed to update employee')
    }
  }

  if (isEmployeeLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <DashboardLayout title={`Edit ${employee?.fullName || 'Employee'}`}>
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          to={`/employees/${id}`}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Details
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Update Employee Information</CardTitle>
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
                          <Input {...field} />
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
                          <Input {...field} />
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
                          <Input {...field} value={field.value || ''} />
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
                          <Input {...field} />
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
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="visiting">Visiting</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
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
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
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

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Active Status
                          </FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Employee is currently working at the clinic
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
                </div>

                <div className="flex justify-end gap-4 border-t pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate({ to: `/employees/${id}` })}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Update Employee
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
