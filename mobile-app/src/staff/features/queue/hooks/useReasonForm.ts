import { useForm, useStore } from '@tanstack/react-form';

import { reasonSchema, type ReasonValues } from '../schemas/reason.schema';

const defaultValues: ReasonValues = { reason: '' };

/**
 * Form of the ReasonSheet (pause / send for test / abort / out-of-order call).
 * Schema wired as `validators`; `onSubmit` gets the trimmed reason, or
 * `undefined` when an optional reason was left empty.
 */
export function useReasonForm(
  required: boolean,
  onSubmit: (reason: string | undefined) => Promise<void>,
) {
  const schema = reasonSchema(required);
  const form = useForm({
    defaultValues,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      await onSubmit(value.reason.trim() || undefined);
    },
  });
  const isDirty = useStore(form.store, (s) => s.isDirty);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  return { form, isDirty, canSubmit, isSubmitting };
}
