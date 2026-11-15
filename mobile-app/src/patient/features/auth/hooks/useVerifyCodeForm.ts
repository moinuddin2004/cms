import { useForm } from '@tanstack/react-form';
import { useCallback, useEffect, useState } from 'react';

import { t } from '@/core/i18n';
import { persistSession } from '@/patient/lib/api';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { startEmail, verifyEmail } from '../api/auth.api';
import { startErrorKey, verifyErrorKey } from '../lib/auth-errors';
import { verifyCodeSchema, type VerifyCodeFormValues } from '../schemas/auth.schema';

export const RESEND_AFTER_SECONDS = 60;

const defaultValues: VerifyCodeFormValues = { code: '' };

/**
 * Verify the emailed code and store the session; where the user lands next
 * (name step or the main screens) is decided by the layout's guard. Also owns
 * the 60 s resend countdown.
 */
export function useVerifyCodeForm() {
  const email = usePatientAuthStore((s) => s.pendingEmail);
  const setPendingEmail = usePatientAuthStore((s) => s.setPendingEmail);
  const [globalError, setGlobalError] = useState('');
  const [notice, setNotice] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const form = useForm({
    defaultValues,
    validators: { onChange: verifyCodeSchema, onSubmit: verifyCodeSchema },
    onSubmit: async ({ value }) => {
      if (!email) return;
      setGlobalError('');
      setNotice('');
      try {
        await persistSession(await verifyEmail(email, value.code));
      } catch (err) {
        setGlobalError(t(verifyErrorKey(err)));
      }
    },
  });

  const resend = useCallback(async () => {
    if (!email || secondsLeft > 0 || resending) return;
    setResending(true);
    setGlobalError('');
    try {
      await startEmail(email);
      setNotice(t('auth.verify.resent'));
      setSecondsLeft(RESEND_AFTER_SECONDS);
    } catch (err) {
      setGlobalError(t(startErrorKey(err)));
    } finally {
      setResending(false);
    }
  }, [email, secondsLeft, resending]);

  /** Back to the email step. */
  const changeEmail = useCallback(() => setPendingEmail(null), [setPendingEmail]);

  return { form, email, globalError, notice, secondsLeft, resending, resend, changeEmail };
}
