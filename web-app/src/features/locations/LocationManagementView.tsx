import { useState, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
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
import { LocationTable } from './components/LocationTable'

export interface Location {
  id: string
  name: string
  code: string
  organizationId: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  isActive: boolean
  organization?: {
    id: string
    name: string
  }
}

export const LocationManagementView = forwardRef<{ create: () => void }>(function LocationManagementView(_props, ref) {
  const { isSuperAdmin } = useAuthStore()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [locToEdit, setLocToEdit] = useState<Location | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Location | null>(null)

  const { data: locationsData, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await apiClient.get('/locations')
      return res.data.data as Location[]
    },
  })

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await apiClient.get('/organizations')
      return res.data.data as { id: string; name: string }[]
    },
    enabled: isSuperAdmin,
  })

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Location>) =>
      apiClient.post('/locations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setIsFormOpen(false)
      toast.success('Location created successfully')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to create location'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Location> }) =>
      apiClient.patch(`/locations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      setIsFormOpen(false)
      toast.success('Location updated successfully')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to update location'),
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/locations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast.success('Location deactivated')
    },
    onError: (err: any) =>
      toast.error(
        err.response?.data?.message || 'Failed to deactivate location',
      ),
  })

  const [formData, setFormData] = useState<Partial<Location>>({})

  const handleCreateNew = () => {
    setLocToEdit(null)
    setFormData({})
    setIsFormOpen(true)
  }

  useImperativeHandle(ref, () => ({ create: handleCreateNew }))

  const openEdit = (loc: Location) => {
    setLocToEdit(loc)
    setFormData(loc)
    setIsFormOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSuperAdmin && !formData.organizationId && !locToEdit) {
      toast.error('Organization is required for Super Admins')
      return
    }
    if (locToEdit) {
      updateMutation.mutate({ id: locToEdit.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const navigate = useNavigate()

  return (
    <div className="flex flex-col space-y-6">
      <LocationTable
        locations={locationsData ?? []}
        isLoading={isLoading}
        showOrganization={isSuperAdmin}
        onSettings={(loc) => navigate({ to: `/locations/${loc.id}/settings` })}
        onEdit={openEdit}
        onDeactivate={setDeactivateTarget}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate location?"
        description={
          <>
            <strong>{deactivateTarget?.name}</strong> will be deactivated and
            hidden from location selection.
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locToEdit ? 'Edit Location' : 'Create Location'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {isSuperAdmin && !locToEdit && (
              <div className="space-y-2">
                <Label>Organization (Required)</Label>
                <Select
                  value={formData.organizationId || ''}
                  onValueChange={(val) =>
                    setFormData({ ...formData, organizationId: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgsData?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  required
                  disabled={!!locToEdit}
                  value={formData.code || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="e.g. NYC-01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address || ''}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={formData.country || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
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
