import { useForm, useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { toast } from 'sonner-native';

import { toWalkInInput } from '../lib/walk-in-input';
import { queueErrorCode, queueErrorMessage } from '../lib/queue-errors';
import { walkInDefaults, walkInSchema, type WalkInValues } from '../schemas/walk-in.schema';
import type { ArrivalResult, WalkInInput } from '../types/queue.types';
import { useWalkIn } from './useArrivalMutations';

/**
 * Walk-in form (S-02c): schema wired as validators; submit sends the walk-in.
 * `ACTIVE_WITH_OTHER_DOCTOR` does not toast: it parks the input in `forceInput`
 * for the "Add anyway?" dialog, and `confirmForce` resends it with `force: true`
 * — a new `mutateAsync` call, so a new `Idempotency-Key` (the body changed).
 * A failed submit keeps the values.
 */
export function useWalkInForm(
  defaultDoctorId: string,
  onCreated: (result: ArrivalResult, values: WalkInValues) => void,
) {
  const walkIn = useWalkIn();
  const [forceInput, setForceInput] = useState<{ input: WalkInInput; values: WalkInValues } | null>(
    null,
  );

  const send = async (input: WalkInInput, values: WalkInValues) => {
    try {
      const result = await walkIn.mutateAsync(input);
      setForceInput(null);
      onCreated(result, values);
    } catch (err) {
      const code = queueErrorCode(err);
      if (code === 'ACTIVE_WITH_OTHER_DOCTOR' && !input.force) {
        setForceInput({ input, values });
        return;
      }
      setForceInput(null);
      // The mutation hook skips dialog codes; any other one reaching here still needs a message.
      if (code === 'ACTIVE_WITH_OTHER_DOCTOR' || code === 'LATE_LIMIT_EXCEEDED') {
        toast.error(queueErrorMessage(err));
      }
    }
  };

  const form = useForm({
    defaultValues: walkInDefaults(defaultDoctorId),
    validators: { onChange: walkInSchema, onSubmit: walkInSchema },
    onSubmit: ({ value }) => send(toWalkInInput(value), value),
  });

  const confirmForce = async () => {
    if (!forceInput) return;
    await send({ ...forceInput.input, force: true }, forceInput.values);
  };

  const isDirty = useStore(form.store, (s) => s.isDirty);
  return {
    form,
    isDirty,
    forceOpen: forceInput !== null,
    dismissForce: () => setForceInput(null),
    confirmForce,
  };
}
