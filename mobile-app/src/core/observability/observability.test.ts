import { reportError, setErrorReporter, type ErrorReport } from './report';
import { isExpectedError, scrubContext, scrubError, scrubRoute, scrubString } from './scrub';

describe('scrubString', () => {
  it.each([
    ['https://api.example.com/patient-api/records/123?name=Ali', 'url'],
    ['sent to ali.khan@example.com', 'email'],
    ['id 1f2e3d4c-1111-2222-3333-444455556666 failed', 'id'],
    ['Authorization: Bearer abc.def.ghi', 'token'],
    ['claim abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ', 'token'],
    ['call +92 300 1234567 now', 'number'],
    ['jwt eyJhbGciOi.eyJzdWIiOiIxMjM.sig-part_1 end', 'token'],
  ])('redacts %s', (input, marker) => {
    const out = scrubString(input);
    expect(out).toContain(`[${marker}]`);
    expect(out).not.toMatch(/example\.com|ali\.khan|1f2e3d4c|abc\.def|abcdefghijkl|1234567|eyJhbGci|sig-part/);
  });

  it.each([
    ['refresh_token=abc', 'refresh_token=[redacted]'],
    ['access_token: xyz1', 'access_token: [redacted]'],
    ['password=hunter2 ok', 'password=[redacted] ok'],
    ['{"code":"123456"}', '{"code":[redacted]}'],
    ['code=9', 'code=[redacted]'],
  ])('redacts the value of %s whatever its length', (input, expected) => {
    expect(scrubString(input)).toBe(expected);
  });

  it('keeps plain text and truncates long messages', () => {
    expect(scrubString('Network Error')).toBe('Network Error');
    expect(scrubString('x '.repeat(300)).length).toBeLessThanOrEqual(201);
  });
});

describe('scrubRoute', () => {
  it('templates ids and drops the query and host', () => {
    expect(scrubRoute('/patient-api/records/1f2e3d4c-1111-2222-3333-444455556666/prescriptions?x=1')).toBe(
      '/patient-api/records/:id/prescriptions',
    );
    expect(scrubRoute('https://h.example.com/a/42')).toBe('/a/:id');
  });

  it('redacts a short or odd id after a known noun', () => {
    expect(scrubRoute('/patients/ali-khan/notes')).toBe('/patients/:id/notes');
    expect(scrubRoute('/patient-api/claim/abc')).toBe('/patient-api/claim/:id');
    expect(scrubRoute('/v/xyz/appointments/a1')).toBe('/v/:id/appointments/:id');
  });

  it('runs other segments through the string scrubber', () => {
    expect(scrubRoute('/files/ali@x.com/list')).toBe('/files/[email]/list');
  });
});

describe('scrubContext', () => {
  it('keeps only allow-listed primitive keys', () => {
    expect(
      scrubContext({ route: '/x/123456', code: 'E1', status: 500, body: { name: 'Ali' }, patientName: 'Ali', screen: { a: 1 } }),
    ).toEqual({ route: '/x/:id', code: 'E1', status: 500 });
  });
});

describe('scrubError', () => {
  it('never reads the request or response of an axios-like error', () => {
    const err = Object.assign(new Error('Request failed with status code 500'), {
      name: 'AxiosError',
      code: 'ERR_BAD_RESPONSE',
      config: { headers: { Authorization: 'Bearer secret' }, data: '{"name":"Ali"}', url: '/patients/9' },
      response: { status: 500, data: { name: 'Ali Khan' } },
    });
    const out = scrubError(err);
    expect(out).toEqual({
      name: 'AxiosError',
      message: 'Request failed with status code 500',
      code: 'ERR_BAD_RESPONSE',
      status: 500,
    });
    expect(JSON.stringify(out)).not.toMatch(/Ali|secret/);
  });

  it('drops free-text messages: a name cannot be regex-scrubbed', () => {
    expect(scrubError(new Error('Could not save Ali Khan')).message).toBe('');
    expect(scrubError(new Error('Network Error')).message).toBe('Network Error');
    expect(scrubError(new Error('timeout of 15000ms exceeded')).message).toBe('timeout of 15000ms exceeded');
  });

  it('drops a name or code that is not a plain identifier', () => {
    const out = scrubError(Object.assign(new Error('x'), { name: 'Ali Khan failed', code: 'ali@x.com' }));
    expect(out).toEqual({ name: 'Error', message: '' });
  });

  it('handles non-errors', () => {
    expect(scrubError(undefined).name).toBe('NonError');
    expect(scrubError('boom a@b.co')).toEqual({ name: 'NonError', message: '' });
  });
});

describe('isExpectedError', () => {
  it('treats API answers and offline as expected, a bare TypeError as not', () => {
    expect(isExpectedError({ name: 'AxiosError', message: '', status: 404 })).toBe(true);
    expect(isExpectedError({ name: 'AxiosError', message: '', code: 'CLAIM_INVALID' })).toBe(true);
    expect(isExpectedError({ name: 'AxiosError', message: 'Network Error' })).toBe(true);
    expect(isExpectedError({ name: 'TypeError', message: '' })).toBe(false);
  });
});

describe('reportError', () => {
  afterEach(() => setErrorReporter(null));

  it('hands a plugged-in provider scrubbed data only', () => {
    const seen: ErrorReport[] = [];
    setErrorReporter((r) => seen.push(r));
    reportError(new Error('failed for ali@x.com'), { route: '/p/123456', body: 'secret' });
    expect(seen).toEqual([{ error: { name: 'Error', message: '' }, context: { route: '/p/:id' } }]);
  });

  it('never throws, even when the provider does', () => {
    setErrorReporter(() => {
      throw new Error('provider down');
    });
    expect(() => reportError(new Error('x'))).not.toThrow();
  });

  it('is silent without a provider outside development', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    reportError(new Error('x'));
    (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn in development for an expected API failure', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    reportError(Object.assign(new Error('x'), { name: 'AxiosError', response: { status: 409 } }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
