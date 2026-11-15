import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { t } from '@/core/i18n';

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
  onTerminalError: () => void,
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
        if (info.terminal) onTerminalError();
      }
    },
  });

  return { form, globalError };
}
