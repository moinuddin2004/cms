import { isAxiosError } from 'axios';

import { extractErrorCode } from '@/core/http';
import type { MessageKey } from '@/core/i18n';

/** Which message to show for a failed verify-code call (the API uses one generic code for every wrong-code case). */
export function verifyErrorKey(err: unknown): MessageKey {
  const code = extractErrorCode(err);
  if (code === 'CODE_INVALID') return 'auth.verify.wrongCode';
  if (code === 'ACCOUNT_DISABLED') return 'auth.verify.accountDisabled';
  if (isAxiosError(err) && err.response?.status === 429) return 'auth.signIn.rateLimited';
  return 'auth.verify.failed';
}

/** Which message to show for a failed "send me a code" call. */
export function startErrorKey(err: unknown): MessageKey {
  if (isAxiosError(err) && err.response?.status === 429) return 'auth.signIn.rateLimited';
  return 'auth.signIn.failed';
}
