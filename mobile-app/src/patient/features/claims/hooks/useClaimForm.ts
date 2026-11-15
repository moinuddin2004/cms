import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { t, type MessageKey } from '@/core/i18n';

import { acceptClaim } from '../api/claims.api';
import { claimErrorInfo } from '../lib/claim-errors';
import { claimSchema, type ClaimFormValues } from '../schemas/claim.schema';
import type { AcceptClaimResult } from '../types/claims.types';

const defaultValues = (isMinor: boolean): ClaimFormValues => ({
  relation: isMinor ? 'child' : 'self',
  newProfileName: '',
  confirm: false,
});

/**
 * Accept the claim. The patient app has no profiles endpoint yet (M2-10), so
 * "self" uses the account's own profile and every other choice creates a new one
 * from the typed name (docs/07 §6.2).
 */
export function useClaimForm(
  token: string,
  isMinor: boolean,
  onLinked: (result: AcceptClaimResult) => void,
  /** The token can never work: the page shows this message (by key) and keeps the token until the patient closes it. */
  onTerminalError: (messageKey: MessageKey) => void,
) {
  const queryClient = useQueryClient();
  const [globalError, setGlobalError] = useState('');

  const form = useForm({
    defaultValues: defaultValues(isMinor),
    validators: { onChange: claimSchema, onSubmit: claimSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('');
      try {
        const result = await acceptClaim(token, {
          relation: value.relation,
          ...(value.relation === 'self' ? {} : { newProfileName: value.newProfileName.trim() }),
          confirm: true,
        });
        void queryClient.invalidateQueries({ queryKey: ['links'] });
        void queryClient.invalidateQueries({ queryKey: ['profiles'] });
        onLinked(result);
      } catch (err) {
        const info = claimErrorInfo(err);
        setGlobalError(t(info.key));
        if (info.terminal) onTerminalError(info.key);
      }
    },
  });

  return { form, globalError };
}
