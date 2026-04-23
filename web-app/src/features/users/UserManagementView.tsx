import { useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useUsers, useDeleteUser } from './api'
import type { UserRoleType, User } from './types'
import { UserTable } from './components/UserTable'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { UserFormDialog } from './components/UserFormDialog'

export function UserManagementView() {
  const { isSuperAdmin, accessSource, activeOrganizationId } = useAuthStore()
  const [activeTab, setActiveTab] = useState<UserRoleType>(
    isSuperAdmin ? 'super_admin' : 'owner',
  )
  const [page, setPage] = useState(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)

  // Deriving visibility
  const canSeeSuperAdmins = isSuperAdmin
  const canViewModule = isSuperAdmin || accessSource === 'owner'

  const { data: usersData, isLoading } = useUsers(
    activeTab,
    page,
    10,
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

  const handleDelete = (user: User) => {
    if (confirm(`Are you sure you want to delete ${user.email}?`)) {
      deleteMutation.mutate(user.uuid)
    }
  }

  const handleCreateNew = () => {
    setUserToEdit(null)
    setIsFormOpen(true)
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-gray-500">
            Manage system access across roles and organizations.
          </p>
        </div>
        <div>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

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
          <UserTable
            users={usersData?.data || []}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="owner" className="m-0">
          <UserTable
            users={usersData?.data || []}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="employee" className="m-0">
          <UserTable
            users={usersData?.data || []}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Pagination controls if needed */}
      {usersData?.totalPages ? (
        <div className="flex justify-between items-center text-sm">
          <span>
            Page {page} of {usersData.totalPages} | Total: {usersData.total}
          </span>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === usersData.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <UserFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        user={userToEdit}
        activeTab={activeTab}
      />
    </div>
  )
}
