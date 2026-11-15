import { useForm, useStore } from '@tanstack/react-form';

import { buildDecisions, type DecisionDraft } from '../lib/close-decisions';
import { closeSessionSchema } from '../schemas/close-session.schema';
import type { CloseDecision, EntryView } from '../types/queue.types';

/**
 * Close-session form (S-02a): a decision per leftover patient. `canSubmit` also
 * requires every CURRENT leftover to be decided (a patient may arrive while the
 * sheet is open). Failure keeps the choices; success resets them.
 */
export function useCloseSessionForm(
  leftovers: readonly EntryView[],
  hasTargets: boolean,
  submit: (decisions: CloseDecision[]) => Promise<unknown>,
) {
  const form = useForm({
    defaultValues: { drafts: {} as Record<string, DecisionDraft> },
    validators: { onChange: closeSessionSchema, onSubmit: closeSessionSchema },
    onSubmit: async ({ value, formApi }) => {
      const decisions = buildDecisions(leftovers, value.drafts, hasTargets);
      if (!decisions) return;
      try {
        await submit(decisions);
      } catch {
        return;
      }
      formApi.reset();
    },
  });
  const drafts = useStore(form.store, (s) => s.values.drafts);
  const isDirty = useStore(form.store, (s) => s.isDirty);
  const formCanSubmit = useStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const complete = buildDecisions(leftovers, drafts, hasTargets) !== null;
  return { form, drafts, isDirty, canSubmit: formCanSubmit && complete, isSubmitting };
}
