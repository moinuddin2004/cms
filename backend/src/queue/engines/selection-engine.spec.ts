import { Candidate, selectNext, SelectionPolicy } from './selection-engine';
import { isBeyondMaxLate } from './check-in-rules';

/**
 * The 14 required scenarios from the architecture doc (section 12), run with a
 * fixed clock in both modes. Smart: early window 15, grace 10, max late 45,
 * starvation 45. With the flag off every answer except emergency must come
 * from check-in time alone (equal times → lower token).
 */

const t = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00Z`);

const smart: SelectionPolicy = {
  smartQueueEnabled: true,
  earlyWindowMin: 15,
  lateGraceMin: 10,
  starvationMin: 45,
};
const fifo: SelectionPolicy = { ...smart, smartQueueEnabled: false };

let token = 0;
function walkIn(
  id: string,
  at: string,
  extra: Partial<Candidate> = {},
): Candidate {
  return {
    id,
    token: ++token,
    type: 'WALK_IN',
    checkedInAt: t(at),
    sortAnchorAt: t(at),
    ...extra,
  };
}
function appt(
  id: string,
  scheduled: string,
  at: string,
  extra: Partial<Candidate> = {},
): Candidate {
  return {
    id,
    token: ++token,
    type: 'APPOINTMENT',
    scheduledStart: t(scheduled),
    checkedInAt: t(at),
    sortAnchorAt: t(at),
    ...extra,
  };
}

type Scenario = {
  name: string;
  candidates: () => Candidate[];
  now: string;
  lastReason?: string;
  smart: string | null;
  fifo: string | null;
};

const scenarios: Scenario[] = [
  {
    name: '1. walk-in since 9:40, 10:00 appointment arrived 9:58, doctor free 10:01',
    candidates: () => [walkIn('W', '09:40'), appt('A', '10:00', '09:58')],
    now: '10:01',
    smart: 'A',
    fifo: 'W',
  },
  {
    name: '2. appointment 10:00 arrived 9:50 (inside window), walk-in since 9:30',
    candidates: () => [walkIn('W', '09:30'), appt('A', '10:00', '09:50')],
    now: '09:50',
    smart: 'A',
    fifo: 'W',
  },
  {
    name: '3. appointment 10:00 arrived 9:20, walk-in 9:30, doctor free 9:35',
    candidates: () => [appt('A', '10:00', '09:20'), walkIn('W', '09:30')],
    now: '09:35',
    smart: 'A',
    fifo: 'A',
  },
  {
    name: '4. same as 3 but the walk-in has waited since 9:10',
    candidates: () => [appt('A', '10:00', '09:20'), walkIn('W', '09:10')],
    now: '09:35',
    smart: 'W',
    fifo: 'W',
  },
  {
    name: '5. appointment 10:00 arrived 10:08 (inside grace)',
    candidates: () => [walkIn('W', '09:50'), appt('A', '10:00', '10:08')],
    now: '10:08',
    smart: 'A',
    fifo: 'W',
  },
  {
    name: '6. appointment 10:00 arrived 10:25, walk-in since 10:15 (grace over)',
    candidates: () => [walkIn('W', '10:15'), appt('A', '10:00', '10:25')],
    now: '10:25',
    smart: 'W',
    fifo: 'W',
  },
  {
    name: '8. 10:00 patient late-in-grace and 10:15 patient on time',
    candidates: () => [
      appt('A1', '10:00', '10:05'),
      appt('A2', '10:15', '10:10'),
    ],
    now: '10:16',
    smart: 'A1',
    fifo: 'A1',
  },
  {
    name: '9. walk-in waiting 50 min while an appointment is due',
    candidates: () => [walkIn('W', '09:10'), appt('A', '10:00', '09:55')],
    now: '10:00',
    smart: 'W',
    fifo: 'W',
  },
  {
    name: '10. right after a guard call, another walk-in has waited 50 min',
    candidates: () => [walkIn('W2', '09:10'), appt('A', '10:00', '09:55')],
    now: '10:00',
    lastReason: 'STARVATION_GUARD',
    smart: 'A',
    fifo: 'W2',
  },
  {
    name: '11. patient back from a test while walk-ins wait',
    candidates: () => [
      walkIn('W1', '09:30'),
      walkIn('W2', '09:40'),
      walkIn('R', '09:35', { returnedFromHoldAt: t('10:00') }),
    ],
    now: '10:05',
    smart: 'R',
    fifo: 'W1',
  },
  {
    name: '12. emergency priority set',
    candidates: () => [
      walkIn('W', '09:00'),
      appt('A', '10:00', '09:55'),
      walkIn('U', '10:02', { urgentSince: t('10:03') }),
    ],
    now: '10:05',
    smart: 'U',
    fifo: 'U',
  },
  {
    name: '13. two candidates at exactly the same time',
    candidates: () => [
      {
        id: 'T5',
        token: 5,
        type: 'WALK_IN',
        checkedInAt: t('09:30'),
        sortAnchorAt: t('09:30'),
      },
      {
        id: 'T3',
        token: 3,
        type: 'WALK_IN',
        checkedInAt: t('09:30'),
        sortAnchorAt: t('09:30'),
      },
    ],
    now: '09:40',
    smart: 'T3',
    fifo: 'T3',
  },
  {
    name: '14. nobody waiting',
    candidates: () => [],
    now: '10:00',
    smart: null,
    fifo: null,
  },
];

describe('SelectionEngine', () => {
  describe.each([
    ['smart queue ON', smart, 'smart' as const],
    ['smart queue OFF (FIFO)', fifo, 'fifo' as const],
  ])('%s', (_label, policy, key) => {
    it.each(scenarios.map((s) => [s.name, s] as const))('%s', (_name, s) => {
      const decision = selectNext(
        s.candidates(),
        t(s.now),
        policy,
        s.lastReason,
      );
      expect(decision?.entryId ?? null).toBe(s[key]);
    });
  });

  it('9 → 10: after the guard call the due appointment goes next', () => {
    const w = walkIn('W', '09:10');
    const a = appt('A', '10:00', '09:55');
    const first = selectNext([w, a], t('10:00'), smart);
    expect(first).toEqual({ entryId: 'W', reason: 'STARVATION_GUARD' });
    const second = selectNext([a], t('10:01'), smart, first!.reason);
    expect(second).toEqual({ entryId: 'A', reason: 'APPOINTMENT_DUE' });
  });

  it('labels reasons', () => {
    expect(
      selectNext([appt('A', '10:00', '09:58')], t('10:01'), smart)?.reason,
    ).toBe('APPOINTMENT_DUE');
    expect(selectNext([walkIn('W', '09:58')], t('10:01'), fifo)?.reason).toBe(
      'FIFO',
    );
  });
});

describe('check-in rules', () => {
  it('7. appointment 10:00 arriving 10:50 exceeds max late (45)', () => {
    expect(isBeyondMaxLate(t('10:00'), t('10:50'), 45)).toBe(true);
    expect(isBeyondMaxLate(t('10:00'), t('10:45'), 45)).toBe(false);
  });
});
