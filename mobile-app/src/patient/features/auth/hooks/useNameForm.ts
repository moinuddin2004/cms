import { useForm } from '@tanstack/react-form';
import { useState } from 'react';

import { t } from '@/core/i18n';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { updateMyName } from '../api/auth.api';
import { nameSchema, type NameFormValues } from '../schemas/auth.schema';

const defaultValues: NameFormValues = { fullName: '' };

/** Ask a new account for its name once; the layout's guard then opens the main screens. */
export function useNameForm() {
  const [globalError, setGlobalError] = useState('');
  const setAccountName = usePatientAuthStore((s) => s.setAccountName);

  const form = useForm({
    defaultValues,
    validators: { onChange: nameSchema, onSubmit: nameSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('');
      const fullName = value.fullName.trim();
      try {
        await updateMyName(fullName);
        setAccountName(fullName);
      } catch {
        setGlobalError(t('auth.name.failed'));
      }
    },
  });

  return { form, globalError };
}
