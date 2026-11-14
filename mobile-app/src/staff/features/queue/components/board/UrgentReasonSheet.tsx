import { FieldWrapper, FormInput, FormSheet, fieldError } from '@/core/components';

import { useUrgentReasonForm } from './useUrgentReasonForm';

export interface UrgentReasonSheetProps {
  open: boolean;
  onClose: () => void;
  tokenLabel: string;
  /** Resolves on success (the sheet closes); rejects on failure (stays open). */
  onSubmit: (reason: string) => Promise<unknown>;
}

/** "Mark urgent" needs a reason (S-02b). */
export function UrgentReasonSheet({ open, onClose, tokenLabel, onSubmit }: UrgentReasonSheetProps) {
  const { form, isDirty, canSubmit, isSubmitting } = useUrgentReasonForm(async (reason) => {
    await onSubmit(reason);
    onClose();
  });

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={`Mark ${tokenLabel} urgent`}
      isDirty={isDirty}
      closeLabel="Close"
      discard={{
        title: 'Discard changes?',
        description: 'The reason you typed will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      }}
      submit={{
        label: 'Mark urgent',
        disabled: !canSubmit,
        pending: isSubmitting,
        onPress: () => void form.handleSubmit(),
      }}>
      <form.Field name="reason">
        {(field) => (
          <FieldWrapper label="Reason" required error={fieldError(field)}>
            <FormInput
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              placeholder="Why does this patient go first?"
              invalid={!!fieldError(field)}
              returnKeyType="done"
              multiline
            />
          </FieldWrapper>
        )}
      </form.Field>
    </FormSheet>
  );
}
