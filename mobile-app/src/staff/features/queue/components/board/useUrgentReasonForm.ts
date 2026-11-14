import { useForm, useStore } from '@tanstack/react-form';

import { urgentReasonSchema } from './urgent-reason.schema';

/**
 * Reason form of "Mark urgent": schema wired as validators; a failed submit
 * keeps the text (the mutation already toasted). `isDirty` drives "Discard changes?".
 */
export function useUrgentReasonForm(submit: (reason: string) => Promise<unknown>) {
  const form = useForm({
    defaultValues: { reason: '' },
    validators: { onChange: urgentReasonSchema, onSubmit: urgentReasonSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await submit(value.reason.trim());
      } catch {
        return;
      }
      formApi.reset();
    },
  });
  const isDirty = useStore(form.store, (s) => s.isDirty);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  return { form, isDirty, canSubmit, isSubmitting };
}
