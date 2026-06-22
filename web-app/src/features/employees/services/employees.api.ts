import api from '@/lib/api'
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
  const { data } = await api.post('/employees', payload)
  return data.data
}

export async function updateEmployee(
  id: string,
  payload: Partial<EmployeeFormData>,
): Promise<Employee> {
  const { data } = await api.put(`/employees/${id}`, payload)
  return data.data
}

export async function deactivateEmployee(id: string): Promise<void> {
  await api.patch(`/employees/${id}/deactivate`)
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

export async function fetchSalaryHistory(
  employeeId: string,
): Promise<any[]> {
  const { data } = await api.get(`/employees/${employeeId}/salary-history`)
  return data.data
}
