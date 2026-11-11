import { LogOut } from 'lucide-react-native';
import { useState } from 'react';

import { ConfirmDialog, ListRow } from '@/core/components';
import { Icon } from '@/core/ui/icon';
import { useSignOut } from '@/staff/features/auth';

/** "Sign out" row. Nothing happens until the dialog is confirmed (docs/10 M1-02). */
export function SignOutRow() {
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();

  return (
    <>
      <ListRow
        leading={<Icon as={LogOut} className="text-destructive size-5" />}
        title="Sign out"
        onPress={() => setOpen(true)}
      />
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Sign out?"
        description="You will need to sign in again to use the clinic app on this phone."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => signOut.mutateAsync()}
      />
    </>
  );
}
