import { HOUR_MS } from './doses';
import { planReminders } from './plan-reminders';
import { at, event, schedule } from './test-fixtures';

const NOW = at(2026, 11, 16, 9, 0); // Mon 16 Nov, 09:00 phone time

describe('planReminders', () => {
  it('plans the doses of the next 72 hours, earliest first', () => {
    const plan = planReminders([schedule()], [], NOW);
    expect(plan.map((r) => r.fireAtMs)).toEqual([
      at(2026, 11, 16, 20),
      at(2026, 11, 17, 8),
      at(2026, 11, 17, 20),
      at(2026, 11, 18, 8),
      at(2026, 11, 18, 20),
      at(2026, 11, 19, 8),
    ]);
    expect(plan[0].dueAt).toBe(new Date(at(2026, 11, 16, 20)).toISOString());
    expect(plan[0].id).toBe(`dose.s1.${at(2026, 11, 16, 20)}`);
  });

  it('includes a dose exactly at the end of the horizon and excludes one just past it', () => {
    // 09:00 today is "now" (not in the future); 19 Nov 09:00 is exactly +72 h
    const edge = planReminders([schedule({ times: ['09:00'] })], [], NOW);
    expect(edge.map((r) => r.fireAtMs)).toEqual([at(2026, 11, 17, 9), at(2026, 11, 18, 9), at(2026, 11, 19, 9)]);
    expect(planReminders([schedule({ times: ['09:01'] })], [], NOW).at(-1)?.fireAtMs).toBe(at(2026, 11, 18, 9, 1));
  });

  it('never plans a dose that is already due or past', () => {
    const plan = planReminders([schedule({ times: ['08:59', '09:00', '09:01'] })], [], NOW, HOUR_MS);
    expect(plan.map((r) => r.fireAtMs)).toEqual([at(2026, 11, 16, 9, 1)]);
  });

  it('skips doses with a taken or skipped event, matched by instant', () => {
    const plan = planReminders(
      [schedule()],
      [event('s1', at(2026, 11, 16, 20)), event('s1', at(2026, 11, 17, 8), 'skipped')],
      NOW,
    );
    expect(plan[0].fireAtMs).toBe(at(2026, 11, 17, 20));
  });

  it('matches an event whose dueAt the server formatted differently', () => {
    const due = at(2026, 11, 16, 20);
    const e = {
      scheduleId: 's1',
      dueAt: new Date(due).toISOString().replace('.000Z', 'Z'),
      action: 'taken' as const,
      actedAt: new Date(due).toISOString(),
    };
    expect(planReminders([schedule()], [e], NOW)[0].fireAtMs).toBe(at(2026, 11, 17, 8));
  });

  it('only plans active schedules with times', () => {
    const plan = planReminders(
      [
        schedule({ id: 'a', status: 'paused' }),
        schedule({ id: 'b', status: 'stopped' }),
        schedule({ id: 'c', status: 'completed' }),
        schedule({ id: 'd', times: [] }),
        schedule({ id: 'e' }),
      ],
      [],
      NOW,
    );
    expect(new Set(plan.map((r) => r.scheduleId))).toEqual(new Set(['e']));
  });

  it('respects startDate and endDate (inclusive, phone calendar)', () => {
    const s = schedule({ startDate: '2026-11-17', endDate: '2026-11-18' });
    expect(planReminders([s], [], NOW).map((r) => r.fireAtMs)).toEqual([
      at(2026, 11, 17, 8),
      at(2026, 11, 17, 20),
      at(2026, 11, 18, 8),
      at(2026, 11, 18, 20),
    ]);
  });

  it('plans nothing once the course has ended', () => {
    expect(planReminders([schedule({ endDate: '2026-11-15' })], [], NOW)).toEqual([]);
  });

  it('keeps the earliest `cap` reminders across schedules', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      schedule({ id: `s${i}`, times: ['10:00', '12:00', '14:00', '16:00', '18:00'] }),
    );
    const plan = planReminders(many, [], NOW, undefined, 7);
    expect(plan).toHaveLength(7);
    expect(Math.max(...plan.map((r) => r.fireAtMs))).toBeLessThanOrEqual(at(2026, 11, 16, 12));
    expect(plan).toEqual([...plan].sort((a, b) => a.fireAtMs - b.fireAtMs));
  });

  it('defaults to a cap of 60', () => {
    const s = schedule({ times: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:30`) });
    expect(planReminders([s], [], NOW)).toHaveLength(60);
  });

  it('ignores malformed times and duplicates', () => {
    const plan = planReminders(
      [schedule({ times: ['8:00', '25:00', '20:00', '20:00', 'noon'] })],
      [],
      NOW,
      12 * HOUR_MS,
    );
    expect(plan.map((r) => r.fireAtMs)).toEqual([at(2026, 11, 16, 20)]);
  });

  it('is empty for no schedules or cap 0', () => {
    expect(planReminders([], [], NOW)).toEqual([]);
    expect(planReminders([schedule()], [], NOW, undefined, 0)).toEqual([]);
  });

  it('accepts a Date for now', () => {
    expect(planReminders([schedule()], [], new Date(NOW))).toHaveLength(6);
  });

  it('orders equal times by schedule id (stable plan)', () => {
    const plan = planReminders(
      [schedule({ id: 'b', times: ['20:00'] }), schedule({ id: 'a', times: ['20:00'] })],
      [],
      NOW,
      12 * HOUR_MS,
    );
    expect(plan.map((r) => r.scheduleId)).toEqual(['a', 'b']);
  });

  describe('privacy', () => {
    it('keeps the clinical fields when reminders are not private', () => {
      const [r] = planReminders([schedule()], [], NOW, undefined, undefined, { profileName: () => 'Ali Raza' });
      expect(r).toMatchObject({
        private: false,
        profileName: 'Ali Raza',
        medicineName: 'Amoxicillin',
        doseText: '500 mg',
        mealRelation: 'AFTER_MEAL',
      });
    });

    it('carries NO medicine, dose or meal when private', () => {
      const [r] = planReminders([schedule()], [], NOW, undefined, undefined, {
        isPrivate: () => true,
        profileName: () => 'Ali',
      });
      expect(r).toMatchObject({ private: true, profileName: 'Ali', medicineName: null, doseText: null, mealRelation: null });
      expect(JSON.stringify(r)).not.toContain('Amoxicillin');
      expect(JSON.stringify(r)).not.toContain('500');
    });

    it('decides per profile', () => {
      const plan = planReminders(
        [
          schedule({ id: 'a', profileId: 'p1', times: ['20:00'] }),
          schedule({ id: 'b', profileId: 'p2', times: ['20:00'] }),
        ],
        [],
        NOW,
        undefined,
        undefined,
        { isPrivate: (p) => p === 'p2' },
      );
      expect(Object.fromEntries(plan.map((r) => [r.scheduleId, r.private]))).toEqual({ a: false, b: true });
    });
  });
});
