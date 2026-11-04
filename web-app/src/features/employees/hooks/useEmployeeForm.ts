import { useForm } from '@tanstack/react-form'
import { useAuthStore } from '@/store/useAuthStore'
import { todayYmd } from '@/lib/datetime'
import { employeeFormSchema } from '../schemas/employee.schema'
import type { EmployeeFormValues } from '../schemas/employee.schema'
import { EmploymentType } from '../types'
import type { Employee, EmployeeFormData } from '../types'

// Optional text fields go to the API as undefined when left empty.
const blank = (v: string) => (v === '' ? undefined : v)

function defaultsFor(
  employee: Employee | null | undefined,
  activeLocationId: string | null,
): EmployeeFormValues {
  return {
    fullName: employee?.fullName ?? '',
    phone: employee?.phone ?? '',
    cnic: employee?.cnic ?? '',
    designation: employee?.designation ?? '',
    employmentRoleId: employee?.employmentRoleId ?? '',
    employmentType: employee?.employmentType ?? EmploymentType.FULL_TIME,
    joiningDate: employee
      ? employee.joiningDate
        ? employee.joiningDate.split('T')[0]
        : ''
      : todayYmd(),
    primaryLocationId: employee?.primaryLocationId ?? activeLocationId ?? '',
    gender: employee?.gender ?? '',
    dob: employee?.dob ? employee.dob.split('T')[0] : '',
    hasPortalAccess: employee?.hasPortalAccess ?? false,
    portalEmail: '',
    portalLoginMethod: 'password',
    portalPassword: '',
    profilePictureUrl: employee?.profilePictureUrl ?? '',
    userId: employee?.userId ?? '',
    grossSalary: '',
    payType: 'SALARY',
    commissionRate: '',
    commissionBasis: 'NET',
  }
}

/** Create / edit employee form; hands the parsed payload to `onSubmit`. */
export function useEmployeeForm({
  employee,
  onSubmit,
}: {
  employee?: Employee | null
  onSubmit: (data: EmployeeFormData) => Promise<void>
}) {
  const activeLocationId = useAuthStore((s) => s.activeLocationId)
  return useForm({
    defaultValues: defaultsFor(employee, activeLocationId),
    validators: { onChange: employeeFormSchema, onSubmit: employeeFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit({
        ...value,
        cnic: blank(value.cnic),
        gender: value.gender || undefined,
        dob: blank(value.dob),
        portalEmail: blank(value.portalEmail),
        portalPassword:
          value.portalLoginMethod === 'google'
            ? undefined
            : blank(value.portalPassword),
        profilePictureUrl: blank(value.profilePictureUrl),
        userId: blank(value.userId),
        primaryLocationId: blank(value.primaryLocationId),
        grossSalary: value.grossSalary.trim()
          ? Number(value.grossSalary)
          : undefined,
      })
    },
  })
}
