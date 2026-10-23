export interface User {
  uuid: string
  email: string
  name?: string
  phone?: string
  status: 'active' | 'suspended' | 'deleted'
  globalRole: 'super_admin' | null
  createdAt: string
}

export interface PaginatedUsersResponse {
  data: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type UserRoleType = 'super_admin' | 'owner' | 'employee'

export interface CreateUserPayload {
  email: string
  name: string
  password?: string
  type: UserRoleType
  /** `type: 'employee'`: the existing employee this login is for. */
  employeeId?: string
}

/** An employee of the active org that has no login yet. */
export interface StaffCandidate {
  employeeId: string
  name: string
  phone: string
  locations: string[]
}

export interface UpdateUserPayload {
  email?: string
  name?: string
  password?: string
  status?: string
  type?: UserRoleType
}
