import { useState, forwardRef, useImperativeHandle } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useUsers, useDeleteUser } from './api'
import type { UserRoleType, User } from './types'
import { UserTable } from './components/UserTable'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { UserFormDialog } from './components/UserFormDialog'

export const UserManagementView = forwardRef<{ create: () => void }>(function UserManagementView(_props, ref) {
  const { isSuperAdmin, accessSource, activeOrganizationId } = useAuthStore()
  const [activeTab, setActiveTab] = useState<UserRoleType>(
    isSuperAdmin ? 'super_admin' : 'owner',
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)

  // Deriving visibility
  const canSeeSuperAdmins = isSuperAdmin
  const canViewModule = isSuperAdmin || accessSource === 'owner'

  const { data: usersData, isLoading } = useUsers(
    activeTab,
    page,
    pageSize,
    activeOrganizationId || undefined,
  )
  const deleteMutation = useDeleteUser(activeOrganizationId || undefined)

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

      <UserFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        user={userToEdit}
        activeTab={activeTab}
      />
    </div>
  )
})
