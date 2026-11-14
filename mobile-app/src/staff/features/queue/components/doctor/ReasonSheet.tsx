import { useState } from 'react';

import { FieldWrapper, FormInput, FormSheet, fieldError } from '@/core/components';
import { Text } from '@/core/ui/text';

import { useReasonForm } from '../../hooks/useReasonForm';
import { REASON_MAX } from '../../schemas/reason.schema';

/** What the sheet asks for. `onSubmit` resolves true when the sheet may close. */
export interface ReasonRequest {
  /** Changes per opening: resets the form. */
  id: string;
  title: string;
  /** Consequence / context line above the field. */
  description?: string;
  fieldLabel: string;
  required: boolean;
  submitLabel: string;
  onSubmit: (reason: string | undefined) => Promise<boolean>;
}

export interface ReasonSheetProps {
  request: ReasonRequest | null;
  onClose: () => void;
}

interface InnerProps {
  request: ReasonRequest;
  open: boolean;
  onClose: () => void;
}

function ReasonSheetBody({ request, open, onClose }: InnerProps) {
  const { form, isDirty, canSubmit, isSubmitting } = useReasonForm(
    request.required,
    async (reason) => {
      if (await request.onSubmit(reason)) onClose();
    },
  );

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={request.title}
      isDirty={isDirty}
      closeLabel="Close"
      discard={{
        title: 'Discard changes?',
        description: 'What you typed will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      }}
      submit={{
        label: request.submitLabel,
        disabled: !canSubmit,
        pending: isSubmitting,
        onPress: () => void form.handleSubmit(),
      }}>
      {request.description ? <Text variant="muted">{request.description}</Text> : null}
      <form.Field name="reason">
        {(field) => (
          <FieldWrapper
            label={request.fieldLabel}
            required={request.required}
            error={fieldError(field)}>
            <FormInput
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              multiline
              maxLength={REASON_MAX + 50}
              placeholder={request.required ? undefined : 'Optional'}
              invalid={!!fieldError(field)}
              accessibilityLabel={request.fieldLabel}
              className="h-24 py-2"
            />
          </FieldWrapper>
        )}
      </form.Field>
    </FormSheet>
  );
}

/**
 * Small bottom sheet with one textarea (docs/06 S-02a): pause (required),
 * send for test / abort / out-of-order call (optional). The last request stays
 * mounted while the sheet slides away so the content does not jump.
 */
export function ReasonSheet({ request, onClose }: ReasonSheetProps) {
  const [last, setLast] = useState<ReasonRequest | null>(request);
  if (request && request.id !== last?.id) setLast(request);
  const shown = request ?? last;
  if (!shown) return null;
  return (
    <ReasonSheetBody key={shown.id} request={shown} open={request !== null} onClose={onClose} />
  );
}
