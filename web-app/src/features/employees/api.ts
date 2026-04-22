import { apiClient } from '@/lib/api';
import type {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  SetSalaryDto,
  EmployeeListParams,
  PaginatedResponse,
  PayrollRecord,
} from './types';

// ------------- EMPLOYEE endpoints -------------

export const getEmployees = async (
  params: EmployeeListParams
): Promise<PaginatedResponse<Employee>> => {
  const { data } = await apiClient.get('/employees', { params });
  return data;
};

export const getEmployee = async (id: string): Promise<Employee> => {
  const { data } = await apiClient.get(`/employees/${id}`);
  return data.data; // Assuming backend wraps with { success, data }
};

export const createEmployee = async (
  payload: CreateEmployeeDto
): Promise<Employee> => {
  const { data } = await apiClient.post('/employees', payload);
  return data.data;
};

export const updateEmployee = async (
  id: string,
  payload: UpdateEmployeeDto
): Promise<Employee> => {
  const { data } = await apiClient.patch(`/employees/${id}`, payload);
  return data.data;
};

export const setEmployeeSalary = async (
  id: string,
  payload: SetSalaryDto
): Promise<void> => {
  await apiClient.post(`/employees/${id}/salary`, payload);
};

export const deactivateEmployee = async (id: string): Promise<void> => {
  await apiClient.patch(`/employees/${id}/deactivate`);
};

// ------------- PAYROLL endpoints -------------

export const getEmployeePayrollHistory = async (
  employeeId: string
): Promise<PayrollRecord[]> => {
  const { data } = await apiClient.get(`/payroll/employee/${employeeId}`);
  return data.data;
};

export const generatePayroll = async (
  month: number,
  year: number
): Promise<{ generatedCount: number }> => {
  const { data } = await apiClient.post('/payroll/generate', { month, year });
  return data.data;
};

export const markPayrollPaid = async (
  recordId: string,
  payload: { notes?: string }
): Promise<PayrollRecord> => {
  const { data } = await apiClient.patch(`/payroll/${recordId}/mark-paid`, payload);
  return data.data;
};
