import { log } from '@/core/log';

import { queueErrorCode, queueErrorMessage, shouldRefetch } from './queue-errors';

/** Shape of an axios error for a queue API failure (`error.code` + `message`). */
function apiError(code: string | undefined, message = 'Server text', status = 422) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: { isSuccess: false, httpStatusCode: status, message, error: code ? { code } : {} },
    },
  };
}

const STATUS_CHANGED = "This patient's status changed. Please check and try again.";

describe('queueErrorMessage', () => {
  it.each<[string, string]>([
    ['NOT_FOUND', 'This patient is no longer in the queue.'],
    ['FORBIDDEN', "You can't do this for another doctor's queue."],
    ['INVALID_TRANSITION', STATUS_CHANGED],
    ['SESSION_NOT_OPEN', "The session isn't open. Start or resume it first."],
    ['DOCTOR_BUSY', 'Finish the current patient first.'],
    ['VERSION_CONFLICT', STATUS_CHANGED],
    ['ALREADY_CHECKED_IN', 'Already checked in.'],
    ['ACTIVE_WITH_OTHER_DOCTOR', "Already in another doctor's queue. Add anyway?"],
    ['LATE_LIMIT_EXCEEDED', 'Too late for this appointment. Add as walk-in?'],
    ['NOT_TODAY', "This appointment isn't today."],
    ['LOCK_TIMEOUT', 'Busy, please try again.'],
    ['REASON_REQUIRED', 'A reason is required.'],
  ])('%s → friendly copy, not the server text', (code, copy) => {
    expect(queueErrorMessage(apiError(code))).toBe(copy);
  });

  it.each(['IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_REUSED', 'REQUEST_IN_FLIGHT'])(
    '%s → generic copy and one log.error with the code only',
    (code) => {
      const spy = jest.spyOn(log, 'error').mockImplementation(() => undefined);
      expect(queueErrorMessage(apiError(code, 'internal detail'))).toBe(
        'Something went wrong. Please try again.',
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('QueueRequestError', code);
      spy.mockRestore();
    },
  );

  it('falls back to the API message for an unknown code', () => {
    expect(queueErrorMessage(apiError('SOMETHING_NEW', 'Specific server text'))).toBe(
      'Specific server text',
    );
  });

  it('uses the first validation message when the API sends an array', () => {
    const err = apiError(undefined, 'ignored', 400);
    (err.response.data as { message: unknown }).message = ['reason must be shorter', 'x'];
    expect(queueErrorMessage(err)).toBe('reason must be shorter');
  });

  it('reports no connection for a network error', () => {
    const err = Object.assign(new Error('Network Error'), { isAxiosError: true });
    // axios.isAxiosError checks the flag; no response = offline.
    expect(queueErrorMessage(err)).toBe('No connection. Check your internet and try again.');
  });

  it('uses the generic copy when nothing else is known', () => {
    expect(queueErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
    expect(queueErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('does not treat Object prototype names as codes', () => {
    expect(queueErrorMessage(apiError('constructor', 'plain'))).toBe('plain');
  });
});

describe('shouldRefetch', () => {
  it.each(['NOT_FOUND', 'INVALID_TRANSITION', 'VERSION_CONFLICT', 'ALREADY_CHECKED_IN'])(
    'true for %s',
    (code) => {
      expect(shouldRefetch(apiError(code))).toBe(true);
    },
  );

  it.each([
    'FORBIDDEN',
    'SESSION_NOT_OPEN',
    'DOCTOR_BUSY',
    'ACTIVE_WITH_OTHER_DOCTOR',
    'LATE_LIMIT_EXCEEDED',
    'NOT_TODAY',
    'LOCK_TIMEOUT',
    'REASON_REQUIRED',
    'UNKNOWN',
  ])('false for %s', (code) => {
    expect(shouldRefetch(apiError(code))).toBe(false);
  });

  it('false when there is no code or no response', () => {
    expect(shouldRefetch(apiError(undefined))).toBe(false);
    expect(shouldRefetch(new Error('x'))).toBe(false);
    expect(shouldRefetch(null)).toBe(false);
  });
});

describe('queueErrorCode', () => {
  it('reads error.code', () => {
    expect(queueErrorCode(apiError('NOT_TODAY'))).toBe('NOT_TODAY');
    expect(queueErrorCode({})).toBeUndefined();
  });
});
