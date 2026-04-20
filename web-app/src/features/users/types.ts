export interface User {
  uuid: string;
  email: string;
  name?: string;
  phone?: string;
  status: 'active' | 'suspended' | 'deleted';
  globalRole: 'super_admin' | null;
  createdAt: string;
}

export interface PaginatedUsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type UserRoleType = 'super_admin' | 'owner' | 'employee';

export interface CreateUserPayload {
  email: string;
  name: string;
  password?: string;
  type: UserRoleType;
}

export interface UpdateUserPayload {
  email?: string;
  name?: string;
  password?: string;
  status?: string;
  type?: UserRoleType;
}
