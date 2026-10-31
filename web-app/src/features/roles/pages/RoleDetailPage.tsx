import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Copy, Loader2, Lock, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useAccess } from '@/features/access'
import { CloneRoleSheet } from '../components/CloneRoleSheet'
import { HomePageTab } from '../components/HomePageTab'
import { MembersTab } from '../components/MembersTab'
import { PermissionsTab } from '../components/PermissionsTab'
import { RiskReasonDialog } from '../components/RiskReasonDialog'
import { RoleDot, RoleKindBadge } from '../components/role-badges'
import { useRoleEditor } from '../hooks/useRoleEditor'
import { useDeleteRole, useRole } from '../hooks/useRoles'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { toastRoleError } from '../lib/role-errors'

/** One role: Permissions (bundles + advanced), Home page, Members. */
export function RoleDetailPage({ roleId }: { roleId: string }) {
  const navigate = useNavigate()
  const { hasFeature } = useAccess()
  const { data: role, isLoading, isError, refetch } = useRole(roleId)
  const editor = useRoleEditor(role)
  const blocker = useUnsavedChangesGuard(editor.dirty)
  const remove = useDeleteRole()
  const [cloning, setCloning] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const back = { backTo: '/settings/roles', backLabel: 'Back to roles' }

  if (isLoading) {
    return (
      <DashboardLayout title="Role" {...back}>
        <LoadingSkeleton variant="detail" />
      </DashboardLayout>
    )
  }
  if (isError || !role) {
    return (
      <DashboardLayout title="Role" {...back}>
        <ErrorState onRetry={() => void refetch()} />
      </DashboardLayout>
    )
  }

  const readOnly = role.isSystemRole

  const actions = readOnly ? (
    <Button onClick={() => setCloning(true)}>
      <Copy className="size-4" /> Clone to edit
    </Button>
  ) : (
    <>
      <Button
        variant="outline"
        className="text-danger hover:text-danger"
        onClick={() => setDeleting(true)}
      >
        <Trash2 className="size-4" /> Delete
      </Button>
      <Button variant="outline" onClick={() => setCloning(true)}>
        <Copy className="size-4" /> Clone
      </Button>
      <Button
        variant="outline"
        disabled={!editor.dirty || editor.isSaving}
        onClick={editor.reset}
      >
        Discard
      </Button>
      <Button
        disabled={!editor.dirty || editor.isSaving}
        onClick={() => void editor.save()}
      >
        {editor.isSaving && <Loader2 className="size-4 animate-spin" />}
        Save changes
      </Button>
    </>
  )

  return (
    <DashboardLayout
      title={role.name}
      subtitle={role.description ?? undefined}
      actions={actions}
      {...back}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <RoleDot seed={role.id} />
          <RoleKindBadge isSystemRole={role.isSystemRole} />
          <span className="text-sm text-text-3">
            {role.memberCount} active member{role.memberCount === 1 ? '' : 's'}
          </span>
          {editor.dirty && <Badge variant="warning">Unsaved changes</Badge>}
        </div>

        {readOnly && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-panel-2 p-3 text-sm">
            <Lock className="size-4 shrink-0 text-text-3" />
            <p className="flex-1">
              This is a system role and can't be edited. Clone it to make your
              own version.
            </p>
            <Button size="sm" onClick={() => setCloning(true)}>
              Clone to edit
            </Button>
          </div>
        )}

        {editor.error && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-border bg-danger-soft p-3 text-sm text-danger"
          >
            <ShieldAlert className="size-4 shrink-0" />
            <p>{editor.error.message}</p>
          </div>
        )}

        <Tabs defaultValue="permissions">
          <TabsList>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="home">Home page</TabsTrigger>
            <TabsTrigger value="members">
              Members ({role.members.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="permissions">
            <PermissionsTab
              permissions={editor.permissions}
              onChange={editor.change}
              readOnly={readOnly}
              hasFeature={hasFeature}
            />
          </TabsContent>
          <TabsContent value="home">
            <HomePageTab
              homeRoute={editor.homeRoute}
              onChange={editor.setHomeRoute}
              readOnly={readOnly}
            />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab members={role.members} />
          </TabsContent>
        </Tabs>
      </div>

      <RiskReasonDialog
        permissions={editor.pending?.permissions ?? null}
        onConfirm={editor.confirmPending}
        onCancel={editor.cancelPending}
      />
      <CloneRoleSheet
        source={cloning ? role : null}
        onOpenChange={setCloning}
        onCloned={(copy) =>
          void navigate({
            to: '/settings/roles/$roleId',
            params: { roleId: copy.id },
          })
        }
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(o) => !remove.isPending && setDeleting(o)}
        title={`Delete ${role.name}?`}
        description={
          role.memberCount > 0
            ? `${role.memberCount} active member${role.memberCount === 1 ? '' : 's'} still use this role — move them to another role first.`
            : 'This permanently deletes the role. This cannot be undone.'
        }
        confirmLabel="Delete role"
        destructive
        isLoading={remove.isPending}
        onConfirm={() =>
          remove.mutate(role.id, {
            onSuccess: () => {
              setDeleting(false)
              void navigate({ to: '/settings/roles', replace: true })
            },
            onError: (err) => {
              toastRoleError(err)
              setDeleting(false)
            },
          })
        }
      />
      <ConfirmDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(o) => !o && blocker.reset?.()}
        title="Leave without saving?"
        description="Your changes to this role will be lost."
        confirmLabel="Leave"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </DashboardLayout>
  )
}
