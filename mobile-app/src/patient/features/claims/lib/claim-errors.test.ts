import { AxiosError, type AxiosResponse } from 'axios';

import { claimErrorInfo } from './claim-errors';

function apiError(status: number, code?: string) {
  const err = new AxiosError('x');
  err.response = { status, data: { code, error: { code } } } as AxiosResponse;
  return err;
}

describe('claimErrorInfo', () => {
  it.each([
    ['CLAIM_INVALID', 404, 'claim.errors.invalid', true],
    ['CLINIC_SUSPENDED', 403, 'claim.errors.suspended', true],
    ['PATIENT_APP_DISABLED', 403, 'claim.errors.appDisabled', true],
    ['ALREADY_LINKED', 409, 'claim.errors.alreadyLinked', true],
    ['NAME_REQUIRED', 400, 'claim.errors.nameRequired', false],
    ['RELATION_MISMATCH', 400, 'claim.errors.relationMismatch', false],
  ])('%s', (code, status, key, terminal) => {
    expect(claimErrorInfo(apiError(status, code))).toEqual({ key, terminal });
  });

  it('maps rate limit, offline and unknown errors', () => {
    expect(claimErrorInfo(apiError(429)).key).toBe('claim.errors.rateLimited');
    expect(claimErrorInfo(new AxiosError('offline')).key).toBe('claim.errors.network');
    expect(claimErrorInfo(new Error('boom')).key).toBe('claim.errors.generic');
  });
});
