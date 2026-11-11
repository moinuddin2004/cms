import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/ui/alert-dialog';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** State the consequence (docs/05 §7). */
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  /** May be async; the dialog shows a spinner and stays open until it resolves. */
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation over `ui/alert-dialog`. While `onConfirm` runs both buttons are
 * disabled; on success the dialog closes. A rejection keeps it open — the
 * caller's mutation already shows the error toast.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error already surfaced by the caller; keep the dialog open for a retry.
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next && !pending ? onClose() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            className="min-h-11"
            disabled={pending}
            accessibilityState={{ busy: pending, disabled: pending }}
            onPress={() => void handleConfirm()}>
            {pending ? <ActivityIndicator size="small" /> : null}
            <Text>{confirmLabel}</Text>
          </Button>
          <AlertDialogCancel disabled={pending} className="min-h-11">
            <Text>{cancelLabel}</Text>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
