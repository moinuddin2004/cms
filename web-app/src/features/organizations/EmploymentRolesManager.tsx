import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  UserCog,
} from 'lucide-react'

interface EmploymentRole {
  id: string
  name: string
  slug: string
  permissions: Record<string, boolean>
  isSystemRole: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function EmploymentRolesManager() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<EmploymentRole | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<EmploymentRole | null>(
    null,
  )
  const [formName, setFormName] = useState('')

  // ─── Queries ──────────────────────────────────────────────
  const { data: roles = [], isLoading } = useQuery<EmploymentRole[]>({
    queryKey: ['employment-roles'],
    queryFn: async () => {
      const res = await apiClient.get('/employment-roles')
      return res.data.data
    },
  })

  // ─── Mutations ────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.post('/employment-roles', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employment-roles'] })
      toast.success('Role created successfully')
      setIsCreateOpen(false)
      setFormName('')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to create role'),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: { name?: string; isActive?: boolean }
    }) => apiClient.put(`/employment-roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employment-roles'] })
      toast.success('Role updated successfully')
      setEditingRole(null)
      setFormName('')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to update role'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/employment-roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employment-roles'] })
      toast.success('Role deleted successfully')
      setDeleteConfirm(null)
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to delete role'),
  })

  // ─── Handlers ─────────────────────────────────────────────
  const handleCreate = () => {
    if (!formName.trim()) return
    createMutation.mutate(formName.trim())
  }

  const handleUpdate = () => {
    if (!editingRole || !formName.trim()) return
    updateMutation.mutate({ id: editingRole.id, data: { name: formName.trim() } })
  }

  const handleToggleActive = (role: EmploymentRole) => {
    updateMutation.mutate({
      id: role.id,
      data: { isActive: !role.isActive },
    })
  }

  const openEdit = (role: EmploymentRole) => {
    setFormName(role.name)
    setEditingRole(role)
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Employment Roles
          </CardTitle>
          <CardDescription>
            Manage the roles available for employees in this organization (e.g.
            Dentist, Receptionist, Hygienist).
          </CardDescription>
        </div>

        {/* Create Button */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setFormName('')
                setIsCreateOpen(true)
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Employment Role</DialogTitle>
              <DialogDescription>
                Add a new role that can be assigned to employees.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-role-name">Role Name</Label>
                <Input
                  id="create-role-name"
                  placeholder="e.g., Dentist, Receptionist, Lab Technician"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formName.trim() || createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCog className="mx-auto h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No roles defined yet</p>
            <p className="text-sm mt-1">
              Click "Add Role" to create your first employment role.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      role.isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{role.name}</span>
                      {role.isSystemRole && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          System
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {role.slug}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={role.isActive}
                    onCheckedChange={() => handleToggleActive(role)}
                    aria-label={`Toggle ${role.name} active status`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(role)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(role)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingRole}
        onOpenChange={(open) => {
          if (!open) setEditingRole(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update the role name for "{editingRole?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role-name">Role Name</Label>
              <Input
                id="edit-role-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role "
              {deleteConfirm?.name}"? This action cannot be undone.
              Employees currently assigned this role may be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirm && deleteMutation.mutate(deleteConfirm.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
