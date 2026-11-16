import { reportError, setErrorReporter, type ErrorReport } from './report';
import { scrubContext, scrubError, scrubRoute, scrubString } from './scrub';

describe('scrubString', () => {
  it.each([
    ['https://api.example.com/patient-api/records/123?name=Ali', 'url'],
    ['sent to ali.khan@example.com', 'email'],
    ['id 1f2e3d4c-1111-2222-3333-444455556666 failed', 'id'],
    ['Authorization: Bearer abc.def.ghi', 'token'],
    ['claim abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ', 'token'],
    ['call +92 300 1234567 now', 'number'],
  ])('redacts %s', (input, marker) => {
    const out = scrubString(input);
    expect(out).toContain(`[${marker}]`);
    expect(out).not.toMatch(/example\.com|ali\.khan|1f2e3d4c|abc\.def|abcdefghijkl|1234567/);
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

  it('handles non-errors', () => {
    expect(scrubError(undefined).name).toBe('NonError');
    expect(scrubError('boom a@b.co').message).toBe('boom [email]');
  });
});

describe('reportError', () => {
  afterEach(() => setErrorReporter(null));

  it('hands a plugged-in provider scrubbed data only', () => {
    const seen: ErrorReport[] = [];
    setErrorReporter((r) => seen.push(r));
    reportError(new Error('failed for ali@x.com'), { route: '/p/123456', body: 'secret' });
    expect(seen).toEqual([
      { error: { name: 'Error', message: 'failed for [email]' }, context: { route: '/p/:id' } },
    ]);
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
});
