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
import { QueueSettingsSection } from '@/features/queue'

interface OrganizationSettings {
  allowLocationOverride: boolean
  defaultSlotDuration: number
  advanceBookingDays: number
  cancellationNoticeHours: number
  featureAppointments: boolean
  featureInventory: boolean
  featureFinance: boolean
  featureReminders: boolean
}

interface Location {
  id: string
  organizationId: string
  name: string
}

interface LocationSettings {
  id: string
  locationId: string
  appointmentSlotDuration: number
  maxAppointmentsPerDay: number
  advanceBookingDays: number
  cancellationNoticeHours: number
  reminderEnabled: boolean
  reminderDaysBefore: number
  reminderHoursBefore: number
  paymentGateway: string | null
  taxRate: number
  lateFeePercentage: number
  theme: string
}

export function LocationSettingsFeature({
  locationId,
}: {
  locationId: string
}) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<Partial<LocationSettings>>({})

  const { data: location, isLoading: isLocLoading } = useQuery({
    queryKey: ['locations', locationId],
    queryFn: async () => {
      const res = await apiClient.get(`/locations/${locationId}`)
      return res.data.data as Location
    },
  })

  const { data: orgSettings, isLoading: isOrgSettingsLoading } = useQuery({
    queryKey: ['orgSettings', location?.organizationId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/organizations/${location?.organizationId}/settings`,
      )
      return res.data.data as OrganizationSettings
    },
    enabled: !!location?.organizationId,
  })

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['locSettings', locationId],
    queryFn: async () => {
      const res = await apiClient.get(`/locations/${locationId}/settings`)
      return res.data.data as LocationSettings
    },
  })

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<LocationSettings>) =>
      apiClient.patch(`/locations/${locationId}/settings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locSettings', locationId] })
      toast.success('Location settings updated successfully')
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to update settings'),
  })

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const handleChange = (field: keyof LocationSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (isLocLoading || isOrgSettingsLoading || isSettingsLoading)
    return <div>Loading settings...</div>

  const isOverrideDisabled = orgSettings?.allowLocationOverride === false

  // Derive display values. If disabled, fallback to org defaults for some fields.
  const displaySlotDuration = isOverrideDisabled
    ? orgSettings?.defaultSlotDuration
    : formData.appointmentSlotDuration
  const displayAdvanceBooking = isOverrideDisabled
    ? orgSettings?.advanceBookingDays
    : formData.advanceBookingDays
  const displayCancellationHours = isOverrideDisabled
    ? orgSettings?.cancellationNoticeHours
    : formData.cancellationNoticeHours

  return (
    <div className="space-y-6">
      {isOverrideDisabled && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-md border border-amber-200">
          <strong>Notice:</strong> Organization override is disabled. Some
          settings are inherited from the organization and cannot be changed
          here.
        </div>
      )}

      {orgSettings?.featureAppointments !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Appointment Settings</CardTitle>
            <CardDescription>
              Configure booking rules for this location.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Slot Duration (mins)</Label>
              <Input
                type="number"
                disabled={isOverrideDisabled}
                value={displaySlotDuration || ''}
                onChange={(e) =>
                  handleChange(
                    'appointmentSlotDuration',
                    parseInt(e.target.value),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Appointments / Day</Label>
              <Input
                type="number"
                disabled={isOverrideDisabled} // assuming generic policy
                value={formData.maxAppointmentsPerDay || ''}
                onChange={(e) =>
                  handleChange(
                    'maxAppointmentsPerDay',
                    parseInt(e.target.value),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Advance Booking Days</Label>
              <Input
                type="number"
                disabled={isOverrideDisabled}
                value={displayAdvanceBooking || ''}
                onChange={(e) =>
                  handleChange('advanceBookingDays', parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cancellation Notice (hours)</Label>
              <Input
                type="number"
                disabled={isOverrideDisabled}
                value={displayCancellationHours || ''}
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
      )}

      <QueueSettingsSection locationId={locationId} />

      {orgSettings?.featureReminders !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Reminder Settings</CardTitle>
            <CardDescription>Configure automated reminders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4 mt-2">
              <Label>Enable Reminders</Label>
              <Switch
                disabled={isOverrideDisabled}
                checked={!!formData.reminderEnabled}
                onCheckedChange={(val) => handleChange('reminderEnabled', val)}
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Days Before</Label>
                <Input
                  type="number"
                  disabled={isOverrideDisabled}
                  value={formData.reminderDaysBefore || ''}
                  onChange={(e) =>
                    handleChange('reminderDaysBefore', parseInt(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Hours Before</Label>
                <Input
                  type="number"
                  disabled={isOverrideDisabled}
                  value={formData.reminderHoursBefore || ''}
                  onChange={(e) =>
                    handleChange(
                      'reminderHoursBefore',
                      parseInt(e.target.value),
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {orgSettings?.featureFinance !== false && (
        <Card>
          <CardHeader>
            <CardTitle>Payment & Billing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                disabled={isOverrideDisabled}
                value={formData.taxRate || 0}
                onChange={(e) =>
                  handleChange('taxRate', parseFloat(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Late Fee (%)</Label>
              <Input
                type="number"
                step="0.01"
                disabled={isOverrideDisabled}
                value={formData.lateFeePercentage || 0}
                onChange={(e) =>
                  handleChange('lateFeePercentage', parseFloat(e.target.value))
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || isOverrideDisabled}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  )
}
