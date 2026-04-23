import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, Trash2, Settings } from 'lucide-react'
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

export function LocationManagementView() {
  const { isSuperAdmin } = useAuthStore()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [locToEdit, setLocToEdit] = useState<Location | null>(null)

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Location Management
          </h1>
          <p className="text-sm text-gray-500">Manage clinics and branches.</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Create Location
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {isSuperAdmin && <TableHead>Organization</TableHead>}
              <TableHead>City</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={isSuperAdmin ? 6 : 5}
                  className="text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : locationsData?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isSuperAdmin ? 6 : 5}
                  className="text-center"
                >
                  No locations found.
                </TableCell>
              </TableRow>
            ) : (
              locationsData?.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">
                    {loc.name}
                    <div className="text-xs text-gray-500">{loc.code}</div>
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell>{loc.organization?.name || 'Unknown'}</TableCell>
                  )}
                  <TableCell>{loc.city || 'N/A'}</TableCell>
                  <TableCell>{loc.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${loc.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        navigate({ to: `/locations/${loc.id}/settings` })
                      }
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(loc)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {loc.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Deactivate this location?'))
                            deactivateMutation.mutate(loc.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
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
}
