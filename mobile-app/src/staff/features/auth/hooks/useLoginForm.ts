import { useForm } from '@tanstack/react-form';
import { useState } from 'react';

import { apiErrorMessage } from '@/core/http/api-error';
import { persistSession } from '@/staff/lib/api';

import { login } from '../api/auth.api';
import { loginSchema, type LoginFormValues } from '../schemas/auth.schema';

const defaultValues: LoginFormValues = { email: '', password: '', rememberMe: true };

/**
 * Sign in and store the session. Where the user lands next is decided by the
 * root layout's route guards, not here.
 */
export function useLoginForm() {
  const [globalError, setGlobalError] = useState('');

  const form = useForm({
    defaultValues,
    validators: { onChange: loginSchema, onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('');
      try {
        await persistSession(await login({ ...value, email: value.email.trim() }));
      } catch (err) {
        setGlobalError(apiErrorMessage(err, 'Failed to sign in. Please try again.'));
      }
    },
  });

  return { form, globalError };
}
