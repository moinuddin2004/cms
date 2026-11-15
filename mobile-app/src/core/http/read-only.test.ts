import { AxiosError } from 'axios';

import { READ_ONLY_OFFLINE, apiErrorMessage } from './api-error';
import { isRetryable } from './idempotency';

describe('saved-data write refusal (M1-06b)', () => {
  const err = new AxiosError('x', READ_ONLY_OFFLINE);

  it('is never retried', () => {
    expect(isRetryable(err)).toBe(false);
    expect(isRetryable(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(true);
  });

  it('has its own message', () => {
    expect(apiErrorMessage(err, 'fallback')).toBe('Saved data is read-only.');
  });
});
