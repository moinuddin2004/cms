import { useState, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { OrganizationTable } from './components/OrganizationTable'

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
  const [deactivateTarget, setDeactivateTarget] = useState<Organization | null>(null)

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
      <OrganizationTable
        organizations={orgsData ?? []}
        isLoading={isLoading}
        onFeatures={(org) => navigate({ to: `/organizations/${org.id}/features` })}
        onSettings={(org) => navigate({ to: `/organizations/${org.id}/settings` })}
        onEdit={openEdit}
        onDeactivate={setDeactivateTarget}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate organization?"
        description={
          <>
            <strong>{deactivateTarget?.name}</strong> will be deactivated and
            its users will lose access.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        isLoading={deactivateMutation.isPending}
        onConfirm={() => {
          if (!deactivateTarget) return
          deactivateMutation.mutate(deactivateTarget.id, {
            onSettled: () => setDeactivateTarget(null),
          })
        }}
      />

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
