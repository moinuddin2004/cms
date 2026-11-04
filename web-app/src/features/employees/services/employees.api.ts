import api from '@/lib/api'
import {
  percentToBps,
  rupeesToMinor,
} from '@/features/billing/lib/commission-math'
import type {
  Employee,
  EmployeeFormData,
  EmployeeListParams,
  PaginatedResponse,
  SalaryFormData,
} from '../types'

// ─── Employee CRUD ──────────────────────────────────────────────────

export async function fetchEmployees(
  params: EmployeeListParams,
): Promise<PaginatedResponse<Employee>> {
  const { data } = await api.get('/employees', { params })
  return data.data
}

export async function fetchEmployeeById(id: string): Promise<Employee> {
  const { data } = await api.get(`/employees/${id}`)
  return data.data
}

export async function createEmployee(
  payload: EmployeeFormData,
): Promise<Employee> {
  const {
    primaryLocationId: _location,
    payType,
    commissionRate,
    commissionBasis,
    ...body
  } = payload
  // Compensation step: % → basis points and rupees → minor units with integer
  // math only; a plain salaried employee keeps the old `grossSalary` path.
  const compensation =
    payType !== 'SALARY'
      ? {
          type: payType,
          defaultRateBps: percentToBps(commissionRate ?? '') ?? undefined,
          commissionBasis,
          effectiveFrom: body.joiningDate,
          ...(payType === 'SALARY_PLUS_COMMISSION'
            ? {
                baseSalaryMinor:
                  rupeesToMinor(String(body.grossSalary ?? '')) ?? undefined,
              }
            : {}),
        }
      : undefined
  const { data } = await api.post(
    '/employees',
    compensation ? { ...body, grossSalary: undefined, compensation } : body,
  )
  return data.data
}

export async function updateEmployee(
  id: string,
  payload: Partial<EmployeeFormData>,
): Promise<Employee> {
  const {
    primaryLocationId: _location,
    payType: _payType,
    commissionRate: _rate,
    commissionBasis: _basis,
    ...body
  } = payload
  const { data } = await api.put(`/employees/${id}`, body)
  return data.data
}

export async function setEmployeeStatus(
  id: string,
  isActive: boolean,
): Promise<{ employeeId: string; isActive: boolean }> {
  const { data } = await api.patch(`/employees/${id}/status`, { isActive })
  return data.data
}

/** Permanent delete — removes the employee and their payroll, leaves and schedules. */
export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/employees/${id}`)
}

// ─── Portal Access ──────────────────────────────────────────────────

export async function togglePortalAccess(
  employeeId: string,
  hasPortalAccess: boolean,
): Promise<{ employeeId: string; hasPortalAccess: boolean }> {
  const { data } = await api.patch(`/employees/${employeeId}/portal-access`, {
    hasPortalAccess,
  })
  return data.data
}

// ─── Salary Management ──────────────────────────────────────────────

export async function updateSalary(
  employeeId: string,
  payload: SalaryFormData,
): Promise<any> {
  const { data } = await api.patch(`/employees/${employeeId}/salary`, payload)
  return data.data
}

// ─── Salary History ─────────────────────────────────────────────────

export async function fetchSalaryHistory(employeeId: string): Promise<any[]> {
  const { data } = await api.get(`/employees/${employeeId}/salary-history`)
  return data.data
}

/** Unlink the employee's Google account (they changed or lost it). */
export async function resetEmployeeGoogleLink(
  employeeId: string,
): Promise<{ employeeId: string; reset: boolean }> {
  const { data } = await api.delete(`/employees/${employeeId}/google-link`)
  return data.data
}
