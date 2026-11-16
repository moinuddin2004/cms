import { NotificationAudience, RecipientType } from 'src/notifications/notifications.enums';
import { EntryStatus } from '../enums/queue.enums';
import { QueueOrchestrator } from './queue-orchestrator.service';

/**
 * The patient pushes of the orchestrator (M3-07): "turn is near" once per
 * entry, "called" only for patients who use the app. Everything outside the
 * method under test is faked; the manager only answers `query`.
 */
type Entry = {
  id: string;
  patientId: string;
  tokenNumber: number;
  status: EntryStatus;
  turnNearNotifiedAt: Date | null;
};

const SESSION = {
  id: 's1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  doctorId: 'doc-1',
  tokenPrefix: 'A',
};
const NOW = new Date('2026-11-16T10:00:00Z');

function entry(n: number, over: Partial<Entry> = {}): Entry {
  return {
    id: `e${n}`,
    patientId: `p${n}`,
    tokenNumber: n,
    status: EntryStatus.WAITING,
    turnNearNotifiedAt: null,
    ...over,
  };
}

function setup(opts: {
  waiting: Entry[];
  threshold?: number;
  reachable?: string[];
  eventTypes?: string[];
  alreadyMarked?: string[];
}) {
  const marked = new Set(opts.alreadyMarked ?? []);
  const query = jest.fn((sql: string, params: unknown[]) => {
    if (sql.includes('UPDATE queue_entries')) {
      const id = params[0] as string;
      if (marked.has(id)) return Promise.resolve([]);
      marked.add(id);
      return Promise.resolve([{ id }]);
    }
    if (sql.includes('FROM employees')) {
      return Promise.resolve([{ full_name: 'Dr Sana' }]);
    }
    return Promise.resolve([]);
  });
  const enqueueSafely = jest.fn().mockResolvedValue(undefined);
  const patientsWithDevices = jest.fn((_m, _org, ids: string[]) =>
    Promise.resolve(ids.filter((id) => (opts.reachable ?? ids).includes(id))),
  );
  const orch = Object.create(QueueOrchestrator.prototype) as Record<
    string,
    unknown
  >;
  orch.notifications = { enqueueSafely };
  orch.patientDevices = { patientsWithDevices };
  orch.policies = {
    getEffective: () =>
      Promise.resolve({ patientTurnNearAhead: opts.threshold ?? 2 }),
  };
  orch.query = {
    // The engine's order is FIFO here: by token number.
    engineOrder: (waiting: Entry[]) => ({
      order: [...waiting]
        .sort((a, b) => a.tokenNumber - b.tokenNumber)
        .map((e) => e.id),
    }),
  };
  orch.tokens = { format: (p: string, n: number) => `${p}-${n}` };
  const tx = {
    now: NOW,
    manager: { query },
    eventTypes: new Set(opts.eventTypes ?? ['COMPLETED']),
    touchedSessions: new Map([[SESSION.id, SESSION]]),
    sessionEntries: jest.fn().mockResolvedValue(opts.waiting),
  };
  const run = () =>
    (
      orch as unknown as { notifyTurnNear: (t: unknown) => Promise<void> }
    ).notifyTurnNear(tx);
  const runCalled = (e: Entry) =>
    (
      orch as unknown as {
        notifyCalled: (t: unknown, s: unknown, e: Entry) => Promise<void>;
      }
    ).notifyCalled(tx, SESSION, e);
  return { run, runCalled, enqueueSafely, patientsWithDevices, query, tx };
}

const recipientIds = (calls: unknown[][]) =>
  calls.map(
    (c) =>
      (c[1] as { recipients: { id: string }[] }).recipients[0].id,
  );

describe('QueueOrchestrator — patient turn-near push', () => {
  // Fresh objects per test: the code under test marks entries it notified.
  let five: Entry[];
  beforeEach(() => {
    five = [1, 2, 3, 4, 5].map((n) => entry(n));
  });

  it('notifies waiting patients with at most `threshold` people ahead', async () => {
    const { run, enqueueSafely } = setup({ waiting: five, threshold: 2 });
    await run();

    // positions 0, 1, 2 ahead → tokens 1, 2, 3
    expect(recipientIds(enqueueSafely.mock.calls)).toEqual(['p1', 'p2', 'p3']);
    const first = enqueueSafely.mock.calls[0][1] as Record<string, unknown>;
    expect(first).toMatchObject({
      organizationId: 'org-1',
      locationId: 'loc-1',
      eventCode: 'queue.turn_near',
      link: '/visit/e1',
      entity: { type: 'queue_entry', id: 'e1' },
      recipients: [
        {
          audience: NotificationAudience.PATIENT,
          type: RecipientType.PATIENT,
          id: 'p1',
        },
      ],
    });
    const texts = enqueueSafely.mock.calls.map(
      (c) => (c[1] as { variables: { ahead_text: string } }).variables.ahead_text,
    );
    expect(texts).toEqual([
      "You're next",
      '1 person ahead of you',
      '2 people ahead of you',
    ]);
  });

  it('uses the clinic threshold (0 = only the next patient)', async () => {
    const { run, enqueueSafely } = setup({ waiting: five, threshold: 0 });
    await run();
    expect(recipientIds(enqueueSafely.mock.calls)).toEqual(['p1']);
  });

  it('never twice: an entry that already carries the marker is left alone', async () => {
    const waiting = [entry(1, { turnNearNotifiedAt: NOW }), entry(2), entry(3)];
    const { run, enqueueSafely } = setup({ waiting });
    await run();
    expect(recipientIds(enqueueSafely.mock.calls)).toEqual(['p2', 'p3']);
  });

  it('never twice: losing the atomic marker race sends nothing', async () => {
    const { run, enqueueSafely } = setup({
      waiting: [entry(1), entry(2)],
      alreadyMarked: ['e1'],
    });
    await run();
    expect(recipientIds(enqueueSafely.mock.calls)).toEqual(['p2']);
  });

  it('a second run in the same transaction does not repeat the push', async () => {
    const { run, enqueueSafely } = setup({ waiting: [entry(1), entry(2)] });
    await run();
    await run();
    expect(enqueueSafely).toHaveBeenCalledTimes(2);
  });

  it('skips patients without the app and leaves them unmarked for later', async () => {
    const { run, enqueueSafely, query } = setup({
      waiting: [entry(1), entry(2)],
      reachable: ['p2'],
    });
    await run();
    expect(recipientIds(enqueueSafely.mock.calls)).toEqual(['p2']);
    const marks = query.mock.calls.filter(([sql]) =>
      String(sql).includes('UPDATE queue_entries'),
    );
    expect(marks.map(([, p]) => (p as string[])[0])).toEqual(['e2']);
  });

  it('a check-in is evaluated too: the new patient may already be near', async () => {
    const { run, enqueueSafely } = setup({
      waiting: five,
      eventTypes: ['CHECKED_IN'],
    });
    await run();
    expect(recipientIds(enqueueSafely.mock.calls)).toEqual(['p1', 'p2', 'p3']);
  });

  it('does nothing when nobody is waiting', async () => {
    const { run, enqueueSafely, patientsWithDevices } = setup({ waiting: [] });
    await run();
    expect(patientsWithDevices).not.toHaveBeenCalled();
    expect(enqueueSafely).not.toHaveBeenCalled();
  });
});

describe('QueueOrchestrator — patient pushes never break the staff action', () => {
  const run = (orch: Record<string, unknown>, work: () => Promise<void>) => {
    const query = jest.fn().mockResolvedValue([]);
    const logger = { error: jest.fn() };
    orch.logger = logger;
    const tx = { manager: { query } };
    const p = (
      orch as unknown as {
        patientPush: (t: unknown, w: string, f: () => Promise<void>) => Promise<void>;
      }
    ).patientPush(tx, 'queue.called', work);
    return { p, query, logger };
  };
  const orch = () => Object.create(QueueOrchestrator.prototype) as Record<string, unknown>;

  it('a throwing helper is rolled back to its savepoint, logged, and swallowed', async () => {
    const { p, query, logger } = run(orch(), () => Promise.reject(new Error('boom')));
    await expect(p).resolves.toBeUndefined();
    expect(query.mock.calls.map((c) => c[0])).toEqual([
      'SAVEPOINT patient_push',
      'ROLLBACK TO SAVEPOINT patient_push',
    ]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('a clean helper releases the savepoint', async () => {
    const { p, query } = run(orch(), () => Promise.resolve());
    await p;
    expect(query.mock.calls.map((c) => c[0])).toEqual([
      'SAVEPOINT patient_push',
      'RELEASE SAVEPOINT patient_push',
    ]);
  });
});

describe('QueueOrchestrator — patient called push', () => {
  it('sends clinic, doctor and token only, to a patient who uses the app', async () => {
    const { runCalled, enqueueSafely } = setup({ waiting: [] });
    await runCalled(entry(7, { status: EntryStatus.CALLED }));

    expect(enqueueSafely).toHaveBeenCalledTimes(1);
    expect(enqueueSafely.mock.calls[0][1]).toMatchObject({
      eventCode: 'queue.called',
      variables: { token: 'A-7', doctor_name: 'Dr Sana' },
      link: '/visit/e7',
      recipients: [{ type: RecipientType.PATIENT, id: 'p7' }],
    });
  });

  it('sends nothing for a patient without the app', async () => {
    const { runCalled, enqueueSafely } = setup({ waiting: [], reachable: [] });
    await runCalled(entry(7, { status: EntryStatus.CALLED }));
    expect(enqueueSafely).not.toHaveBeenCalled();
  });
});
