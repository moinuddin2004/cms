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
import { useCreateEmployee } from '@/hooks/useEmployees'
import { toast } from 'sonner'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'

const employeeSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  cnic: z.string().optional(),
  designation: z.string().min(2, 'Designation is required'),
  employmentRoleId: z.string().min(1, 'Role is required'),
  employmentType: z.enum(['full_time', 'part_time', 'visiting', 'contract']),
  joiningDate: z.string().min(1, 'Joining date is required'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dob: z.string().optional(),
  hasPortalAccess: z.boolean().default(false),
})

type EmployeeFormValues = z.infer<typeof employeeSchema>

export const Route = createFileRoute('/employees/create')({
  component: CreateEmployeePage,
})

function CreateEmployeePage() {
  const navigate = useNavigate()
  const createMutation = useCreateEmployee()

  // Fetch roles for the select dropdown
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
      joiningDate: new Date().toISOString().split('T')[0],
      hasPortalAccess: false,
    },
  })

  async function onSubmit(data: EmployeeFormValues) {
    try {
      const res = await createMutation.mutateAsync(data)
      toast.success('Employee added successfully')
      navigate({ to: `/employees/${res.data.data.id}` })
    } catch (error) {
      toast.error('Failed to create employee')
    }
  }

  return (
    <DashboardLayout title="Add New Employee">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          to="/employees"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Employees
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
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
                          value={field.value}
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
                    onClick={() => navigate({ to: '/employees' })}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Employee
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
