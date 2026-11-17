import { translate } from '@/core/i18n';

import { planReminders } from './plan-reminders';
import { buildScheduledReminders, windowEndReminder } from './reminder-window';
import { at, schedule } from './test-fixtures';

const t = (key: Parameters<typeof translate>[0], params?: Parameters<typeof translate>[1]) =>
  translate(key, params, 'en');
const NOW = at(2026, 11, 16, 9);
const H72 = 72 * 3600000;

describe('window-end nudge', () => {
  it('lands at now + 72 h when the plan is not cut by the cap', () => {
    const plan = planReminders([schedule()], [], NOW);
    const end = windowEndReminder(plan, NOW, t)!;
    expect(end.fireAtMs).toBeGreaterThanOrEqual(NOW + H72);
    expect(end.fireAtMs).toBeLessThan(NOW + H72 + 3600000);
    expect(end.fireAtMs % 3600000).toBe(0);
    expect(end.title).toBe('Open the app to keep your reminders');
    expect(end.id.startsWith('dose.window-end.')).toBe(true);
    expect(end.data.type).toBe('medication.window');
  });

  it('lands right after the last planned dose when the cap cut the window short', () => {
    const many = schedule({ times: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:30`) });
    const plan = planReminders([many], [], NOW, undefined, 10);
    const end = windowEndReminder(plan, NOW, t, undefined, 10)!;
    expect(end.fireAtMs).toBe(plan[9].fireAtMs + 60000);
  });

  it('is absent when nothing is planned (nothing to keep alive)', () => {
    expect(windowEndReminder([], NOW, t)).toBeNull();
    expect(buildScheduledReminders([], NOW, t)).toEqual([]);
  });

  it('is part of the scheduled set, after the doses, and carries no medicine text', () => {
    const plan = planReminders([schedule({ times: ['20:00'] })], [], NOW);
    const all = buildScheduledReminders(plan, NOW, t);
    expect(all).toHaveLength(plan.length + 1);
    expect(JSON.stringify(all.at(-1))).not.toContain('Amoxicillin');
  });

  it('has an Urdu text of its own', () => {
    const plan = planReminders([schedule()], [], NOW);
    const ur = windowEndReminder(plan, NOW, (k, p) => translate(k, p, 'ur'))!;
    expect(ur.title).not.toBe('Open the app to keep your reminders');
  });
});
