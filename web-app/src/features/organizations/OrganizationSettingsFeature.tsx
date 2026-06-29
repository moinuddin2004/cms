import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { EmploymentRolesManager } from './EmploymentRolesManager'

interface OrganizationSettings {
  id: string
  organizationId: string
  featureAppointments: boolean
  featureInventory: boolean
  featureFinance: boolean
  featureReminders: boolean
  featureWhatsapp: boolean
  featurePatientPortal: boolean
  allowLocationOverride: boolean
  defaultSlotDuration: number
  advanceBookingDays: number
  cancellationNoticeHours: number
}

export function OrganizationSettingsFeature({
  organizationId,
}: {
  organizationId: string
}) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<Partial<OrganizationSettings>>({})

  const { data: settings, isLoading } = useQuery({
    queryKey: ['orgSettings', organizationId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/organizations/${organizationId}/settings`,
      )
      return res.data.data as OrganizationSettings
    },
  })

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<OrganizationSettings>) =>
      apiClient.patch(`/organizations/${organizationId}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['orgSettings', organizationId],
      })
      toast.success('Organization settings updated successfully')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to update settings'),
  })

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const handleChange = (field: keyof OrganizationSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (isLoading) return <div>Loading settings...</div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Overrides</CardTitle>
          <CardDescription>
            Configure overriding rules for locations in this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <Label className="text-base">Allow Location Override</Label>
              <p className="text-sm text-muted-foreground">
                If enabled, locations can have their own custom settings. If
                disabled, they will inherit these organization settings and
                their local settings will be disabled.
              </p>
            </div>
            <Switch
              checked={!!formData.allowLocationOverride}
              onCheckedChange={(val) =>
                handleChange('allowLocationOverride', val)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Enable or disable specific modules for this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div className="flex items-center justify-between border rounded p-4">
            <Label>Appointments</Label>
            <Switch
              checked={!!formData.featureAppointments}
              onCheckedChange={(val) =>
                handleChange('featureAppointments', val)
              }
            />
          </div>
          {/* Inventory feature toggle — hidden until feature is ready */}
          {/* <div className="flex items-center justify-between border rounded p-4">
            <Label>Inventory</Label>
            <Switch
              checked={!!formData.featureInventory}
              onCheckedChange={(val) => handleChange('featureInventory', val)}
            />
          </div> */}
          <div className="flex items-center justify-between border rounded p-4">
            <Label>Finance</Label>
            <Switch
              checked={!!formData.featureFinance}
              onCheckedChange={(val) => handleChange('featureFinance', val)}
            />
          </div>
          <div className="flex items-center justify-between border rounded p-4">
            <Label>Reminders</Label>
            <Switch
              checked={!!formData.featureReminders}
              onCheckedChange={(val) => handleChange('featureReminders', val)}
            />
          </div>
          <div className="flex items-center justify-between border rounded p-4">
            <Label>WhatsApp Integration</Label>
            <Switch
              checked={!!formData.featureWhatsapp}
              onCheckedChange={(val) => handleChange('featureWhatsapp', val)}
            />
          </div>
          <div className="flex items-center justify-between border rounded p-4">
            <Label>Patient Portal</Label>
            <Switch
              checked={!!formData.featurePatientPortal}
              onCheckedChange={(val) =>
                handleChange('featurePatientPortal', val)
              }
            />
          </div>
        </CardContent>
      </Card>

      <EmploymentRolesManager />

      <Card>
        <CardHeader>
          <CardTitle>Booking Defaults</CardTitle>
          <CardDescription>
            Default parameters used across locations unless overridden.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>Default Slot Duration (mins)</Label>
            <Input
              type="number"
              value={formData.defaultSlotDuration || 30}
              onChange={(e) =>
                handleChange('defaultSlotDuration', parseInt(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Advance Booking Days</Label>
            <Input
              type="number"
              value={formData.advanceBookingDays || 30}
              onChange={(e) =>
                handleChange('advanceBookingDays', parseInt(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Cancellation Notice (hours)</Label>
            <Input
              type="number"
              value={formData.cancellationNoticeHours || 24}
              onChange={(e) =>
                handleChange(
                  'cancellationNoticeHours',
                  parseInt(e.target.value),
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  )
}
