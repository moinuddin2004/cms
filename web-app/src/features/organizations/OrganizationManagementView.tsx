import { useState, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { OrganizationTable } from './components/OrganizationTable'
import { useOrganizationForm } from './hooks/useOrganizationForm'
import type { OrganizationPayload } from './hooks/useOrganizationForm'
import { SUBSCRIPTION_PLANS } from './schemas/organization.schema'
import type { SubscriptionPlan } from './schemas/organization.schema'

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

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

export const OrganizationManagementView = forwardRef<{ create: () => void }>(
  function OrganizationManagementViewImpl(_props, ref) {
    const queryClient = useQueryClient()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null)
    const [deactivateTarget, setDeactivateTarget] =
      useState<Organization | null>(null)

    const { data: orgsData, isLoading } = useQuery({
      queryKey: ['organizations'],
      queryFn: async () => {
        const res = await apiClient.get('/organizations')
        return res.data.data as Organization[]
      },
    })

    const createMutation = useMutation({
      mutationFn: async (data: OrganizationPayload) =>
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
        data: OrganizationPayload
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
      mutationFn: async (id: string) =>
        apiClient.delete(`/organizations/${id}`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] })
        toast.success('Organization deactivated')
      },
      onError: (err: any) =>
        toast.error(
          err.response?.data?.message || 'Failed to deactivate organization',
        ),
    })

    const { form } = useOrganizationForm({
      open: isFormOpen,
      organization: orgToEdit,
      onCreate: (data) => createMutation.mutateAsync(data),
      onUpdate: (id, data) => updateMutation.mutateAsync({ id, data }),
    })

    const handleCreateNew = () => {
      setOrgToEdit(null)
      setIsFormOpen(true)
    }

    useImperativeHandle(ref, () => ({ create: handleCreateNew }))

    const openEdit = (org: Organization) => {
      setOrgToEdit(org)
      setIsFormOpen(true)
    }

    const navigate = useNavigate()

    return (
      <div className="flex flex-col space-y-6">
        <OrganizationTable
          organizations={orgsData ?? []}
          isLoading={isLoading}
          onFeatures={(org) =>
            navigate({ to: `/organizations/${org.id}/features` })
          }
          onSettings={(org) =>
            navigate({ to: `/organizations/${org.id}/settings` })
          }
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

        <Dialog
          open={isFormOpen}
          onOpenChange={(o) => !form.state.isSubmitting && setIsFormOpen(o)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {orgToEdit ? 'Edit Organization' : 'Create Organization'}
              </DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
            >
              <form.Field name="name">
                {(f) => (
                  <FieldWrapper
                    label="Name"
                    htmlFor="organization-name"
                    required
                    error={fieldError(f)}
                  >
                    <Input
                      id="organization-name"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                      aria-invalid={!!fieldError(f)}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
              {orgToEdit && (
                <FieldWrapper label="Slug" htmlFor="organization-slug">
                  <Input
                    id="organization-slug"
                    disabled
                    value={orgToEdit.slug || ''}
                  />
                </FieldWrapper>
              )}
              <form.Field name="subscriptionPlan">
                {(f) => (
                  <FieldWrapper
                    label="Subscription Plan"
                    htmlFor="organization-plan"
                    required
                    error={fieldError(f)}
                  >
                    <Select
                      clearable={false}
                      value={f.state.value}
                      onValueChange={(val) => {
                        f.handleChange(val as SubscriptionPlan)
                        f.handleBlur()
                      }}
                    >
                      <SelectTrigger id="organization-plan" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBSCRIPTION_PLANS.map((plan) => (
                          <SelectItem key={plan} value={plan}>
                            {PLAN_LABEL[plan]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldWrapper>
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
                  selector={(st) => [st.canSubmit, st.isSubmitting] as const}
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
