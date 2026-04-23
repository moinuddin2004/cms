import apiClient from '@/lib/api'
import type {
  CreateEmployeeDto,
  SetSalaryDto,
  UpdateEmployeeDto,
} from '@/types/employee.types'

export const employeesApi = {
  getAll: (params: {
    search?: string
    role?: string
    isActive?: boolean
    page?: number
    limit?: number
  }) => apiClient.get('/employees', { params }),

  getOne: (id: string) => apiClient.get(`/employees/${id}`),

  create: (data: CreateEmployeeDto) => apiClient.post('/employees', data),

  update: (id: string, data: UpdateEmployeeDto) =>
    apiClient.put(`/employees/${id}`, data),

  deactivate: (id: string) => apiClient.patch(`/employees/${id}/deactivate`),

  setSalary: (id: string, data: SetSalaryDto) =>
    apiClient.post(`/employees/${id}/salary`, data),

  getSalaryHistory: (id: string) =>
    apiClient.get(`/employees/${id}/salary-history`),
}
