import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '@/api/employees.api'
import { useAuthStore } from '@/store/useAuthStore'
import type {
  CreateEmployeeDto,
  SetSalaryDto,
  UpdateEmployeeDto,
} from '@/types/employee.types'

export const useEmployees = (filters: {
  search?: string
  role?: string
  isActive?: boolean
}) => {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['employees', activeLocationId, filters],
    queryFn: () => employeesApi.getAll(filters).then((r) => r.data.data),
    enabled: !!activeLocationId,
  })
}

export const useEmployee = (id: string) =>
  useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getOne(id).then((r) => r.data.data),
    enabled: !!id,
  })

export const useCreateEmployee = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEmployeeDto) => employeesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export const useUpdateEmployee = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateEmployeeDto) => employeesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee', id] })
    },
  })
}

export const useSetSalary = (employeeId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SetSalaryDto) =>
      employeesApi.setSalary(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] })
    },
  })
}
