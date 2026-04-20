import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { User, UserRoleType } from '../types';
import { useCreateUser, useUpdateUser } from '../api';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  activeTab: UserRoleType;
}

export function UserFormDialog({ open, onOpenChange, user, activeTab }: UserFormDialogProps) {
  const { isSuperAdmin, activeOrganizationId } = useAuthStore();
  const createMutation = useCreateUser(activeOrganizationId || undefined);
  const updateMutation = useUpdateUser(activeOrganizationId || undefined);
  
  const isEditing = !!user;

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      type: activeTab,
      status: 'active',
      organizationId: '',
    }
  });

  const watchType = watch('type');

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await apiClient.get('/organizations');
      return res.data.data as { id: string; name: string }[];
    },
    enabled: isSuperAdmin && watchType === 'owner',
  });

  useEffect(() => {
    if (open) {
      if (user) {
        setValue('name', user.name || '');
        setValue('email', user.email || '');
        setValue('status', user.status || 'active');
        setValue('type', (user.globalRole === 'super_admin' ? 'super_admin' : activeTab) as UserRoleType);
      } else {
        reset({ name: '', email: '', password: '', type: activeTab, status: 'active', organizationId: '' });
      }
    }
  }, [open, user, activeTab, reset, setValue]);

  const onSubmit = (data: any) => {
    if (isEditing && user) {
      updateMutation.mutate({
        id: user.uuid,
        payload: {
           name: data.name,
           email: data.email,
           ...(data.password ? { password: data.password } : {}),
           status: data.status,
           type: data.type,
        }
      }, {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        }
      });
    } else {
      createMutation.mutate({
        name: data.name,
        email: data.email,
        password: data.password,
        type: data.type,
        ...(data.organizationId ? { organizationId: data.organizationId } : {})
      }, {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit User' : 'Create User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register('name', { required: true })} placeholder="John Doe" />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register('email', { required: true })} placeholder="user@example.com" />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select 
              value={watchType} 
              onValueChange={(val) => setValue('type', val as UserRoleType)}
              disabled={isEditing || !isSuperAdmin} // Only super admin can change role types when creating
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="employee" disabled>Employee (Create via Employee Module)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Employees can only be created from the Employee directory.
            </p>
          </div>

          {isSuperAdmin && watchType === 'owner' && !isEditing && (
            <div className="space-y-2">
              <Label>Organization (Required for Owners)</Label>
              <Select 
                value={watch('organizationId')} 
                onValueChange={(val) => setValue('organizationId', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgsData?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Password {isEditing && '(Leave blank to keep current)'}</Label>
            <Input type="password" {...register('password')} placeholder={isEditing ? '******' : 'Enter a strong password'} />
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                 value={watch('status')} 
                 onValueChange={(val) => setValue('status', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end pt-4 space-x-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
