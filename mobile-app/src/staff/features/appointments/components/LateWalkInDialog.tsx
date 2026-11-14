import { ConfirmDialog } from '@/core/components';

export interface LateWalkInDialogProps {
  open: boolean;
  onClose: () => void;
  /** Converts the booking; rejects on failure so the dialog stays open. */
  onConfirm: () => Promise<void>;
}

/** `LATE_LIMIT_EXCEEDED` (docs/06 S-03, docs/07 §2.3): offer to add the patient as a walk-in. */
export function LateWalkInDialog({ open, onClose, onConfirm }: LateWalkInDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Too late for this appointment"
      description="Too late for this appointment. Add as walk-in? The patient joins the queue as a walk-in."
      confirmLabel="Add as walk-in"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
    />
  );
}
