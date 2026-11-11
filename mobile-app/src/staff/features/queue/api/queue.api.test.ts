import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { staffApi } from '@/staff/lib/api';

import { queueKeys } from './queue.keys';
import {
  callNext,
  checkInAppointment,
  completeEntry,
  fetchBoard,
  fetchMySession,
  registerWalkIn,
  transferEntry,
} from './queue.api';

/**
 * Drives the real staff axios instance with a fake adapter and inspects the
 * request it would send — headers, method, url, body — plus the unwrapping.
 */
let sent: InternalAxiosRequestConfig[] = [];

function respond(data: unknown) {
  staffApi.defaults.adapter = async (config): Promise<AxiosResponse> => {
    sent.push(config);
    return { data: { data, isSuccess: true }, status: 200, statusText: 'OK', headers: {}, config };
  };
}

describe('queue api mutations', () => {
  const defaultAdapter = staffApi.defaults.adapter;

  beforeEach(() => {
    sent = [];
  });
  afterEach(() => {
    staffApi.defaults.adapter = defaultAdapter;
  });

  it('sends Idempotency-Key and a quoted If-Match, and returns the unwrapped data', async () => {
    respond({ entry: { id: 'e1' }, eventSeq: 4 });

    const result = await completeEntry({ entryId: 'e1' }, { idempotencyKey: 'key-1', ifMatch: 7 });

    expect(result).toEqual({ entry: { id: 'e1' }, eventSeq: 4 });
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe('patch');
    expect(sent[0].url).toBe('/queue/entries/e1/complete');
    expect(sent[0].headers.get('Idempotency-Key')).toBe('key-1');
    expect(sent[0].headers.get('If-Match')).toBe('"7"');
  });

  it('omits If-Match when no version is given', async () => {
    respond({ entry: null, reason: 'NO_ELIGIBLE_PATIENT', eventSeq: 1 });

    await callNext({ sessionId: 's1' }, { idempotencyKey: 'key-2' });

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/queue/sessions/s1/call-next');
    expect(sent[0].headers.get('Idempotency-Key')).toBe('key-2');
    expect(sent[0].headers.has('If-Match')).toBe(false);
  });

  it('sends If-Match 0 (version zero is still a version)', async () => {
    respond({ entry: {}, eventSeq: 1 });
    await completeEntry({ entryId: 'e1' }, { idempotencyKey: 'k', ifMatch: 0 });
    expect(sent[0].headers.get('If-Match')).toBe('"0"');
  });

  it('puts only documented fields in the body', async () => {
    respond({ from: {}, entry: {}, token: 'B-001', sessionId: 's2' });

    await transferEntry(
      { entryId: 'e1', toDoctorId: 'd2', reason: 'Closer to specialist' },
      { idempotencyKey: 'k', ifMatch: 2 },
    );

    expect(sent[0].url).toBe('/queue/entries/e1/transfer');
    expect(JSON.parse(sent[0].data as string)).toEqual({
      toDoctorId: 'd2',
      reason: 'Closer to specialist',
    });
  });

  it('sends a walk-in as-is to /queue/walk-ins', async () => {
    respond({ entry: {}, token: 'A-001', sessionId: 's1', doctorId: 'd1', serviceDate: 'x', eventSeq: 1 });

    await registerWalkIn(
      { doctorId: 'd1', patientName: 'Hina', patientPhone: '0300', force: true },
      { idempotencyKey: 'k' },
    );

    expect(sent[0].method).toBe('post');
    expect(sent[0].url).toBe('/queue/walk-ins');
    expect(JSON.parse(sent[0].data as string)).toEqual({
      doctorId: 'd1',
      patientName: 'Hina',
      patientPhone: '0300',
      force: true,
    });
  });

  it('check-in targets the appointments path with the key', async () => {
    respond({});
    await checkInAppointment({ appointmentId: 'a 1', urgentReason: 'pain' }, { idempotencyKey: 'k' });
    expect(sent[0].method).toBe('patch');
    expect(sent[0].url).toBe('/appointments/a%201/check-in');
    expect(sent[0].headers.get('Idempotency-Key')).toBe('k');
  });
});

describe('queue api reads', () => {
  const defaultAdapter = staffApi.defaults.adapter;

  beforeEach(() => {
    sent = [];
  });
  afterEach(() => {
    staffApi.defaults.adapter = defaultAdapter;
  });

  it('reads send no idempotency headers and unwrap data', async () => {
    respond({ session: { id: 's1' } });
    expect(await fetchMySession()).toEqual({ session: { id: 's1' } });
    expect(sent[0].method).toBe('get');
    expect(sent[0].url).toBe('/queue/my-session');
    expect(sent[0].headers.has('Idempotency-Key')).toBe(false);
    expect(sent[0].headers.has('If-Match')).toBe(false);
  });

  it('board passes the date as a query param only when given', async () => {
    respond({ lanes: [] });
    await fetchBoard('2026-11-11');
    await fetchBoard();
    expect(sent[0].params).toEqual({ date: '2026-11-11' });
    expect(sent[1].params).toBeUndefined();
  });
});

describe('queueKeys', () => {
  it('all keys start with "queue" and carry every variable', () => {
    expect(queueKeys.all).toEqual(['queue']);
    expect(queueKeys.mySession('l1', '2026-11-11')).toEqual(['queue', 'my-session', 'l1', '2026-11-11']);
    expect(queueKeys.board('l1', '2026-11-11')).toEqual(['queue', 'board', 'l1', '2026-11-11']);
    expect(queueKeys.session('s1')).toEqual(['queue', 'session', 's1']);
    expect(queueKeys.ticket('e1')).toEqual(['queue', 'ticket', 'e1']);
    expect(queueKeys.patientVisits('p1')).toEqual(['queue', 'patient-visits', 'p1']);
  });
});
