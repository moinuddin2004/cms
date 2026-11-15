import { isAxiosError } from 'axios';

import { extractErrorCode } from '@/core/http';
import type { MessageKey } from '@/core/i18n';

export interface ClaimErrorInfo {
  key: MessageKey;
  /** The token can never work again (or not for this person): drop it and let the patient leave. */
  terminal: boolean;
}

/** Plain, kind wording for every error the claim endpoints can answer (docs/07 §6.2 "Claims as built"). */
export function claimErrorInfo(err: unknown): ClaimErrorInfo {
  const code = extractErrorCode(err);
  switch (code) {
    case 'CLAIM_INVALID':
      return { key: 'claim.errors.invalid', terminal: true };
    case 'CLINIC_SUSPENDED':
      return { key: 'claim.errors.suspended', terminal: true };
    case 'PATIENT_APP_DISABLED':
      return { key: 'claim.errors.appDisabled', terminal: true };
    case 'ALREADY_LINKED':
      return { key: 'claim.errors.alreadyLinked', terminal: true };
    case 'NAME_REQUIRED':
      return { key: 'claim.errors.nameRequired', terminal: false };
    case 'RELATION_MISMATCH':
      return { key: 'claim.errors.relationMismatch', terminal: false };
    default:
      break;
  }
  if (isAxiosError(err)) {
    if (err.response?.status === 429) return { key: 'claim.errors.rateLimited', terminal: false };
    if (!err.response) return { key: 'claim.errors.network', terminal: false };
  }
  return { key: 'claim.errors.generic', terminal: false };
}
