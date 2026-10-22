import api from '@/lib/api'
import type {
  CloneRoleInput,
  CreateRoleInput,
  RoleDetail,
  RoleSummary,
  UpdateRoleInput,
} from '../types/roles.types'

/** Roles & permission bundles (`/admin/roles`, needs admin.roles.manage). */
export const rolesApi = {
  list: async (): Promise<RoleSummary[]> => {
    const { data } = await api.get('/admin/roles')
    return data.data as RoleSummary[]
  },
  get: async (id: string): Promise<RoleDetail> => {
    const { data } = await api.get(`/admin/roles/${id}`)
    return data.data as RoleDetail
  },
  create: async (input: CreateRoleInput): Promise<RoleDetail> => {
    const { data } = await api.post('/admin/roles', input)
    return data.data as RoleDetail
  },
  clone: async (id: string, input: CloneRoleInput): Promise<RoleDetail> => {
    const { data } = await api.post(`/admin/roles/${id}/clone`, input)
    return data.data as RoleDetail
  },
  update: async (id: string, input: UpdateRoleInput): Promise<RoleDetail> => {
    const { data } = await api.patch(`/admin/roles/${id}`, input)
    return data.data as RoleDetail
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/admin/roles/${id}`)
  },
}
