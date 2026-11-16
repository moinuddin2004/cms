import { translate } from '@/core/i18n';

import { planReminders } from './plan-reminders';
import { buildReminderContent, firstName, mealLabel } from './reminder-content';
import { at, schedule } from './test-fixtures';

const t = (key: Parameters<typeof translate>[0], params?: Parameters<typeof translate>[1]) =>
  translate(key, params, 'en');
const NOW = at(2026, 11, 16, 9);

const request = (ctx: Parameters<typeof planReminders>[5]) =>
  planReminders([schedule({ times: ['20:00'] })], [], NOW, undefined, undefined, ctx)[0];

describe('buildReminderContent', () => {
  it('shows name, medicine, dose and meal when not private', () => {
    expect(buildReminderContent(request({ profileName: () => 'Ali Raza' }), t)).toEqual({
      title: 'Ali: Amoxicillin',
      body: '500 mg · After meal',
    });
  });

  it('works without a profile name', () => {
    expect(buildReminderContent(request({}), t).title).toBe('Amoxicillin');
  });

  it('private: "Medicine reminder for Ali" and nothing clinical anywhere', () => {
    const c = buildReminderContent(request({ isPrivate: () => true, profileName: () => 'Ali Raza' }), t);
    expect(c.title).toBe('Medicine reminder for Ali');
    expect(`${c.title} ${c.body}`).not.toMatch(/Amoxicillin|500|meal/i);
  });

  it('private without a name', () => {
    expect(buildReminderContent(request({ isPrivate: () => true }), t).title).toBe('Medicine reminder');
  });

  it('falls back to a generic body when there is no detail', () => {
    const r = planReminders([schedule({ times: ['20:00'], doseText: '', mealRelation: 'NONE' })], [], NOW)[0];
    expect(buildReminderContent(r, t).body).toBe('Time for your medicine.');
  });

  it('helpers', () => {
    expect(firstName('  Ali  Raza ')).toBe('Ali');
    expect(firstName('')).toBeNull();
    expect(firstName(null)).toBeNull();
    expect(mealLabel('NONE', t)).toBeNull();
    expect(mealLabel('EMPTY_STOMACH', t)).toBe('On an empty stomach');
  });
});
