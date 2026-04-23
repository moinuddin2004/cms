export type EmploymentType = 'full_time' | 'part_time' | 'visiting' | 'contract'

export type PayrollStatus = 'pending' | 'paid' | 'on_hold'

export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque'

export interface CurrentSalary {
  id: string
  grossSalary: number
  effectiveFrom: string
  notes?: string
}

export interface Employee {
  id: string
  employeeCode: string
  fullName: string
  phone: string
  cnic?: string
  gender?: 'male' | 'female' | 'other'
  dob?: string
  designation: string
  employmentType: EmploymentType
  joiningDate: string
  hasPortalAccess: boolean
  isActive: boolean
  primaryLocation: { id: string; name: string }
  employmentRole: { id: string; name: string }
  currentSalary?: CurrentSalary
}

export interface PayrollRecord {
  id: string
  employeeId: string
  month: number
  year: number
  periodLabel: string
  salaryAmount: number
  status: PayrollStatus
  paidAt?: string
  paymentMethod?: PaymentMethod
  paymentReference?: string
  notes?: string
}

export interface CreateEmployeeDto {
  fullName: string
  phone: string
  cnic?: string
  designation: string
  employmentRoleId: string
  employmentType: EmploymentType
  joiningDate: string
  gender?: 'male' | 'female' | 'other'
  dob?: string
  hasPortalAccess: boolean
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {
  isActive?: boolean
}

export interface SetSalaryDto {
  grossSalary: number
  effectiveFrom: string
  notes?: string
}
