import { useForm } from '@tanstack/react-form';
import { useState } from 'react';

import { t } from '@/core/i18n';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { startEmail } from '../api/auth.api';
import { startErrorKey } from '../lib/auth-errors';
import { signInSchema, type SignInFormValues } from '../schemas/auth.schema';

const defaultValues: SignInFormValues = { email: '' };

/**
 * Ask for a login code. On success the pending email goes to the store and the
 * layout's guard moves to the verify-code screen (no router call here, and the
 * email never travels in a URL).
 */
export function useSignInForm() {
  const [globalError, setGlobalError] = useState('');
  const setPendingEmail = usePatientAuthStore((s) => s.setPendingEmail);

  const form = useForm({
    defaultValues,
    validators: { onChange: signInSchema, onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('');
      const email = value.email.trim();
      try {
        await startEmail(email);
        setPendingEmail(email);
      } catch (err) {
        setGlobalError(t(startErrorKey(err)));
      }
    },
  });

  return { form, globalError };
}
