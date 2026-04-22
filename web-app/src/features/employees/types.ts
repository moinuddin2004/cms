export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  cnic: string | null;
  gender: 'male' | 'female' | 'other' | null;
  dob: string | null;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern' | null;
  employmentRoleId: string | null;
  primaryLocationId: string | null;
  joinedAt: string;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  salaries?: EmployeeSalary[];
  payrollRecords?: PayrollRecord[];
  
  // Potential joined data
  location?: { id: string; name: string };
  role?: { id: string; name: string };
}

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  amount: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  salaryAmount: number;
  deductions: number;
  bonuses: number;
  netPay: number;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt: string | null;
  paidBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  name: string;
  email?: string;
  phone?: string;
  cnic?: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'intern';
  joinedAt?: string;
  isActive?: boolean;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export interface SetSalaryDto {
  amount: number;
  currency?: string;
  effectiveFrom: string;
}

export interface EmployeeListParams {
  page?: number;
  limit?: number;
  search?: string;
  employmentType?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
