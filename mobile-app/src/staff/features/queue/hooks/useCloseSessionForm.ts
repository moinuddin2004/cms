import { useForm, useStore } from '@tanstack/react-form';
import { useEffect } from 'react';

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
  const validate = (drafts: Record<string, DecisionDraft>) => {
    const live = new Set(leftovers.map((e) => e.id));
    const pruned = Object.fromEntries(Object.entries(drafts).filter(([id]) => live.has(id)));
    const result = closeSessionSchema.safeParse({ drafts: pruned });
    return result.success ? undefined : result.error.issues[0]?.message;
  };
  const form = useForm({
    defaultValues: { drafts: {} as Record<string, DecisionDraft> },
    // A choice for a patient who has left the list has no row to fix it: only the
    // drafts of the CURRENTLY listed leftovers are validated.
    validators: {
      onChange: ({ value }) => validate(value.drafts),
      onSubmit: ({ value }) => validate(value.drafts),
    },
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
  // The leftovers changed (someone left or arrived): drop errors that belonged to them.
  const liveIds = leftovers.map((e) => e.id).join(',');
  useEffect(() => {
    void form.validate('change');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `form` is stable; only the id set matters
  }, [liveIds]);
  const drafts = useStore(form.store, (s) => s.values.drafts);
  const isDirty = useStore(form.store, (s) => s.isDirty);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  // Derived from the LIVE leftovers (not the form's stale error state): submit re-validates anyway.
  const complete = buildDecisions(leftovers, drafts, hasTargets) !== null;
  return { form, drafts, isDirty, canSubmit: complete, isSubmitting };
}
