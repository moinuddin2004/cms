import { type User } from '../types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, User as UserIcon, Edit, Trash } from 'lucide-react';
import { format } from 'date-fns';

interface UserTableProps {
  users: User[];
  isLoading: boolean;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UserTable({ users, isLoading, onEdit, onDelete }: UserTableProps) {
  const getRoleIcon = (role: string | null) => {
    if (role === 'super_admin') return <ShieldAlert className="w-4 h-4 mr-1 text-red-500" />;
    return <UserIcon className="w-4 h-4 mr-1 text-blue-500" />;
  };

  if (isLoading) {
    return <div className="text-center p-8 text-sm text-gray-500">Loading users...</div>;
  }

  if (users.length === 0) {
    return <div className="text-center p-8 text-sm text-gray-500">No users found.</div>;
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.uuid}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.name || 'Unknown Name'}</span>
                  <span className="text-xs text-gray-500">{user.email}</span>
                  {user.phone && <span className="text-xs text-gray-400">{user.phone}</span>}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  {getRoleIcon(user.globalRole)}
                  <span className="text-sm font-medium">
                    {user.globalRole === 'super_admin' ? 'Super Admin' : 'User'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    user.status === 'active'
                      ? 'default'
                      : user.status === 'suspended'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {user.createdAt ? format(new Date(user.createdAt), 'MMM dd, yyyy') : 'N/A'}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(user)}>
                  <Edit className="w-4 h-4 text-gray-600" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(user)}>
                  <Trash className="w-4 h-4 text-red-600" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
