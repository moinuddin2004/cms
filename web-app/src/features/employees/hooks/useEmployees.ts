import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  setEmployeeSalary,
  deactivateEmployee,
} from '../api';
import type { EmployeeListParams, CreateEmployeeDto, UpdateEmployeeDto, SetSalaryDto } from '../types';

export const EMPLOYEE_KEYS = {
  all: ['employees'] as const,
  lists: () => [...EMPLOYEE_KEYS.all, 'list'] as const,
  list: (params: EmployeeListParams) => [...EMPLOYEE_KEYS.lists(), params] as const,
  details: () => [...EMPLOYEE_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...EMPLOYEE_KEYS.details(), id] as const,
};

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: EMPLOYEE_KEYS.list(params),
    queryFn: () => getEmployees(params),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: EMPLOYEE_KEYS.detail(id),
    queryFn: () => getEmployee(id),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmployeeDto) => createEmployee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.lists() });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEmployeeDto }) =>
      updateEmployee(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.lists() });
    },
  });
}

export function useSetEmployeeSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SetSalaryDto }) =>
      setEmployeeSalary(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.detail(id) });
    },
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateEmployee(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_KEYS.lists() });
    },
  });
}
