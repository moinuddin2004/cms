import { useState, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { FormSelect } from '@/components/forms/FormSelect'
import { fieldError } from '@/components/forms/fieldError'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TIMEZONE_OPTIONS, timezoneLabel } from '@/lib/datetime'
import { LocationTable } from './components/LocationTable'
import { useLocationForm } from './hooks/useLocationForm'
import type {
  LocationCreatePayload,
  LocationUpdatePayload,
} from './hooks/useLocationForm'

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
  timezone?: string
  isActive: boolean
  organization?: {
    id: string
    name: string
  }
}

export const LocationManagementView = forwardRef<{ create: () => void }>(
  function LocationManagementViewImpl(_props, ref) {
    const { isSuperAdmin, setLocationTimezone } = useAuthStore()
    const queryClient = useQueryClient()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [locToEdit, setLocToEdit] = useState<Location | null>(null)
    const [deactivateTarget, setDeactivateTarget] = useState<Location | null>(
      null,
    )

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
      mutationFn: async (data: LocationCreatePayload) =>
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
      mutationFn: async ({
        id,
        data,
      }: {
        id: string
        data: LocationUpdatePayload
      }) => apiClient.patch(`/locations/${id}`, data),
      onSuccess: (_res, { id, data }) => {
        // Times on screen follow the new zone right away, no re-login needed.
        setLocationTimezone(id, data.timezone)
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

    const { form } = useLocationForm({
      open: isFormOpen,
      location: locToEdit,
      requireOrganization: isSuperAdmin && !locToEdit,
      onCreate: (data) => createMutation.mutateAsync(data),
      onUpdate: (id, data) => updateMutation.mutateAsync({ id, data }),
    })

    const handleCreateNew = () => {
      setLocToEdit(null)
      setIsFormOpen(true)
    }

    useImperativeHandle(ref, () => ({ create: handleCreateNew }))

    const openEdit = (loc: Location) => {
      setLocToEdit(loc)
      setIsFormOpen(true)
    }

    const orgOptions = (orgsData ?? []).map((org) => ({
      value: org.id,
      label: org.name,
    }))

    const text = (
      name: 'address' | 'city' | 'country' | 'phone' | 'email',
      label: string,
      props: {
        type?: string
        inputMode?: 'tel' | 'email'
        placeholder?: string
      } = {},
    ) => (
      <form.Field name={name}>
        {(f) => (
          <FieldWrapper
            label={label}
            htmlFor={`location-${name}`}
            error={fieldError(f)}
          >
            <Input
              id={`location-${name}`}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
              aria-invalid={!!fieldError(f)}
              {...props}
            />
          </FieldWrapper>
        )}
      </form.Field>
    )

    const navigate = useNavigate()

    return (
      <div className="flex flex-col space-y-6">
        <LocationTable
          locations={locationsData ?? []}
          isLoading={isLoading}
          showOrganization={isSuperAdmin}
          onSettings={(loc) =>
            navigate({
              to: '/settings/locations/$id',
              params: { id: loc.id },
            })
          }
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

        <Dialog
          open={isFormOpen}
          onOpenChange={(o) => !form.state.isSubmitting && setIsFormOpen(o)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {locToEdit ? 'Edit Location' : 'Create Location'}
              </DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
            >
              {isSuperAdmin && !locToEdit && (
                <form.Field name="organizationId">
                  {(f) => (
                    <FormSelect
                      label="Organization"
                      required
                      placeholder="Select Organization"
                      value={f.state.value}
                      onValueChange={(v) => {
                        f.handleChange(v)
                        f.handleBlur()
                      }}
                      options={orgOptions}
                      error={fieldError(f)}
                    />
                  )}
                </form.Field>
              )}

              <div className="grid grid-cols-2 gap-4">
                <form.Field name="name">
                  {(f) => (
                    <FieldWrapper
                      label="Name"
                      htmlFor="location-name"
                      required
                      error={fieldError(f)}
                    >
                      <Input
                        id="location-name"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                        aria-invalid={!!fieldError(f)}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                <form.Field name="code">
                  {(f) => (
                    <FieldWrapper
                      label="Code"
                      htmlFor="location-code"
                      required
                      error={fieldError(f)}
                      hint={locToEdit ? "Code can't be changed." : undefined}
                    >
                      <Input
                        id="location-code"
                        disabled={!!locToEdit}
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                        aria-invalid={!!fieldError(f)}
                        placeholder="e.g. NYC-01"
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              </div>

              {text('address', 'Address')}

              <div className="grid grid-cols-2 gap-4">
                {text('city', 'City')}
                {text('country', 'Country')}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {text('phone', 'Phone', {
                  inputMode: 'tel',
                  placeholder: '0300 1234567',
                })}
                {text('email', 'Email', { type: 'email', inputMode: 'email' })}
              </div>

              <form.Field name="timezone">
                {(f) => (
                  <FormSelect
                    label="Timezone"
                    required
                    value={f.state.value}
                    onValueChange={(v) => {
                      f.handleChange(v)
                      f.handleBlur()
                    }}
                    options={(TIMEZONE_OPTIONS.includes(f.state.value)
                      ? TIMEZONE_OPTIONS
                      : [f.state.value, ...TIMEZONE_OPTIONS]
                    ).map((zone) => ({
                      value: zone,
                      label: timezoneLabel(zone),
                    }))}
                    error={fieldError(f)}
                    hint="Appointments, queue and reports at this location use this clock."
                  />
                )}
              </form.Field>

              <div className="flex justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  className="mr-2"
                >
                  Cancel
                </Button>
                <form.Subscribe
                  selector={(s) => [s.canSubmit, s.isSubmitting] as const}
                >
                  {([canSubmit, isSubmitting]) => (
                    <Button type="submit" disabled={!canSubmit || isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Save
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  },
)
