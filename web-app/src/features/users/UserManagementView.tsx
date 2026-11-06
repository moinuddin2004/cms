import { useState, forwardRef, useImperativeHandle } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useAccess } from '@/features/access'
import { toast } from 'sonner'
import {
  useUsers,
  useDeleteUser,
  useMarkEmailVerified,
  useResendUserVerification,
} from './api'
import type { UserRoleType, User } from './types'
import { UserTable } from './components/UserTable'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { UserFormDialog } from './components/UserFormDialog'

export const UserManagementView = forwardRef<{ create: () => void }>(
  function UserManagementView(_props, ref) {
    const { activeOrganizationId } = useAuthStore()
    const { can, isSuperAdmin, isOwner } = useAccess()
    const [activeTab, setActiveTab] = useState<UserRoleType>(
      isSuperAdmin ? 'super_admin' : 'owner',
    )
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [userToDelete, setUserToDelete] = useState<User | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [userToEdit, setUserToEdit] = useState<User | null>(null)

    const canSeeSuperAdmins = isSuperAdmin
    const canViewModule = can('admin.users.manage')
    // Owner accounts are managed only by owners (and super admins).
    const canManageOwners = isSuperAdmin || isOwner

    const { data: usersData, isLoading } = useUsers(
      activeTab,
      page,
      pageSize,
      activeOrganizationId || undefined,
    )
    const deleteMutation = useDeleteUser(activeOrganizationId || undefined)
    const resendMutation = useResendUserVerification(
      activeOrganizationId || undefined,
    )
    const markVerifiedMutation = useMarkEmailVerified()
    const [userToVerify, setUserToVerify] = useState<User | null>(null)

    if (!canViewModule) {
      return (
        <div className="p-8 text-center text-red-500 font-medium">
          You do not have permission to view User Management.
        </div>
      )
    }

    const handleTabChange = (value: string) => {
      setActiveTab(value as UserRoleType)
      setPage(1)
    }

    const handleEdit = (user: User) => {
      setUserToEdit(user)
      setIsFormOpen(true)
    }

    const handleDelete = (user: User) => setUserToDelete(user)

    const handleCreateNew = () => {
      setUserToEdit(null)
      setIsFormOpen(true)
    }

    useImperativeHandle(ref, () => ({ create: handleCreateNew }))

    const tableProps = {
      users: usersData?.data || [],
      isLoading,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onResendVerification: (user: User) => {
        const id = toast.loading(
          `Sending a verification link to ${user.email}…`,
        )
        resendMutation.mutate(user.uuid, {
          onSuccess: (r) =>
            toast.success(
              r.sent
                ? `Verification link sent to ${user.email}`
                : 'This email is already verified',
              { id },
            ),
          onError: () =>
            toast.error('Could not send the email. Try again.', { id }),
        })
      },
      onMarkVerified: isSuperAdmin ? setUserToVerify : undefined,
      readOnly: activeTab === 'owner' && !canManageOwners,
      serverPagination: usersData
        ? {
            page,
            pageSize,
            total: usersData.total,
            onPageChange: setPage,
            onPageSizeChange: (size: number) => {
              setPageSize(size)
              setPage(1)
            },
          }
        : undefined,
    }

    return (
      <div className="flex flex-col space-y-6">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="mb-4">
            {canSeeSuperAdmins && (
              <TabsTrigger value="super_admin">Super Admins</TabsTrigger>
            )}
            <TabsTrigger value="owner">Owners</TabsTrigger>
            <TabsTrigger value="employee">Employees</TabsTrigger>
          </TabsList>

          <TabsContent value="super_admin" className="m-0">
            <UserTable {...tableProps} />
          </TabsContent>
          <TabsContent value="owner" className="m-0">
            <UserTable {...tableProps} />
          </TabsContent>
          <TabsContent value="employee" className="m-0">
            <UserTable {...tableProps} />
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={!!userToDelete}
          onOpenChange={(open) => !open && setUserToDelete(null)}
          title="Delete user?"
          description={
            <>
              <strong>{userToDelete?.email}</strong> will be deleted and will no
              longer be able to sign in.
            </>
          }
          confirmLabel="Delete"
          destructive
          isLoading={deleteMutation.isPending}
          onConfirm={() => {
            if (!userToDelete) return
            deleteMutation.mutate(userToDelete.uuid, {
              onSettled: () => setUserToDelete(null),
            })
          }}
        />

        <ConfirmDialog
          open={!!userToVerify}
          onOpenChange={(open) => !open && setUserToVerify(null)}
          title="Mark email as verified?"
          description={
            <>
              <strong>{userToVerify?.email}</strong> will count as verified
              without the link being clicked, and system emails will go to it.
              Do this only if you are sure the address belongs to this person.
            </>
          }
          confirmLabel="Mark verified"
          isLoading={markVerifiedMutation.isPending}
          onConfirm={() => {
            if (!userToVerify) return
            markVerifiedMutation.mutate(userToVerify.uuid, {
              onSuccess: () =>
                toast.success(`${userToVerify.email} is now verified`),
              onError: () => toast.error('Could not mark it verified.'),
              onSettled: () => setUserToVerify(null),
            })
          }}
        />

        <UserFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          user={userToEdit}
          activeTab={activeTab}
        />
      </div>
    )
  },
)
