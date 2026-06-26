import { useState, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, Trash2, Settings, ToggleRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export interface Organization {
  id: string
  name: string
  slug: string
  subscriptionPlan: string
  isActive: boolean
  clinicType: string
  timezone: string
  currency: string
}

export const OrganizationManagementView = forwardRef<{ create: () => void }>(function OrganizationManagementView(_props, ref) {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null)

  const { data: orgsData, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await apiClient.get('/organizations')
      return res.data.data as Organization[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Organization>) =>
      apiClient.post('/organizations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setIsFormOpen(false)
      toast.success('Organization created successfully')
    },
    onError: (err: any) =>
      toast.error(
        err.response?.data?.message || 'Failed to create organization',
      ),
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<Organization>
    }) => apiClient.patch(`/organizations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setIsFormOpen(false)
      toast.success('Organization updated successfully')
    },
    onError: (err: any) =>
      toast.error(
        err.response?.data?.message || 'Failed to update organization',
      ),
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/organizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Organization deactivated')
    },
    onError: (err: any) =>
      toast.error(
        err.response?.data?.message || 'Failed to deactivate organization',
      ),
  })

  const handleCreateNew = () => {
    setOrgToEdit(null)
    setIsFormOpen(true)
  }

  useImperativeHandle(ref, () => ({ create: handleCreateNew }))

  const [formData, setFormData] = useState<Partial<Organization>>({})

  const openEdit = (org: Organization) => {
    setOrgToEdit(org)
    setFormData(org)
    setIsFormOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (orgToEdit) {
      updateMutation.mutate({ id: orgToEdit.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const navigate = useNavigate()

  return (
    <div className="flex flex-col space-y-6">
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : orgsData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              orgsData?.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.slug}</TableCell>
                  <TableCell>{org.subscriptionPlan}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${org.isActive ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'}`}
                    >
                      {org.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Manage Features"
                      onClick={() =>
                        navigate({ to: `/organizations/${org.id}/features` })
                      }
                    >
                      <ToggleRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Settings"
                      onClick={() =>
                        navigate({ to: `/organizations/${org.id}/settings` })
                      }
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(org)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {org.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Deactivate this organization?'))
                            deactivateMutation.mutate(org.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {orgToEdit ? 'Edit Organization' : 'Create Organization'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                required
                value={formData.name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            {orgToEdit && (
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input disabled value={formData.slug || ''} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Clinic Type</Label>
              <Input
                value={formData.clinicType || ''}
                onChange={(e) =>
                  setFormData({ ...formData, clinicType: e.target.value })
                }
                placeholder="e.g. Dental, Medical"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={formData.timezone || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  placeholder="e.g. Asia/Karachi"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={formData.currency || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  placeholder="e.g. PKR"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              <Select
                value={formData.subscriptionPlan || 'FREE'}
                onValueChange={(val) =>
                  setFormData({ ...formData, subscriptionPlan: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">FREE</SelectItem>
                  <SelectItem value="BASIC">BASIC</SelectItem>
                  <SelectItem value="PREMIUM">PREMIUM</SelectItem>
                  <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
})
