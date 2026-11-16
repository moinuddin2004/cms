import { planReminders } from './plan-reminders';
import { buildReminderContent } from './reminder-content';
import {
  cancelAllDoseReminders,
  contentHash,
  diffReminders,
  notificationId,
  runSerialised,
  syncReminders,
  toScheduled,
  type ReminderPort,
  type ScheduledReminder,
} from './reminder-scheduler';
import { at, schedule } from './test-fixtures';

function fakePort(initial: string[] = []) {
  const pending = new Set(initial);
  const calls: string[] = [];
  const port: ReminderPort = {
    listPendingIds: async () => [...pending],
    schedule: async (r) => {
      calls.push(`add ${r.id}`);
      pending.add(r.id);
    },
    cancel: async (id) => {
      calls.push(`cancel ${id}`);
      pending.delete(id);
    },
  };
  return { port, pending, calls };
}

const sr = (id: string): ScheduledReminder => ({ id, fireAtMs: 1, title: 't', body: 'b', data: {} });

describe('diffReminders', () => {
  it('cancels stale dose ids and adds missing ones', () => {
    expect(diffReminders(['dose.a.1.x', 'dose.b.2.y'], ['dose.a.1.x', 'dose.old.3.z'])).toEqual({
      cancel: ['dose.old.3.z'],
      add: ['dose.b.2.y'],
    });
  });

  it('never cancels notifications that are not dose reminders', () => {
    expect(diffReminders([], ['queue.something', 'dose.a.1.x']).cancel).toEqual(['dose.a.1.x']);
  });

  it('is empty when plan and OS agree', () => {
    expect(diffReminders(['dose.a.1.x'], ['dose.a.1.x'])).toEqual({ cancel: [], add: [] });
  });
});

describe('syncReminders', () => {
  it('cancels before it schedules and leaves foreign notifications alone', async () => {
    const { port, calls, pending } = fakePort(['dose.old.1.a', 'queue.x', 'dose.keep.2.b']);
    const res = await syncReminders(port, [sr('dose.keep.2.b'), sr('dose.new.3.c')]);
    expect(res).toEqual({ cancelled: 1, scheduled: 1 });
    expect(calls).toEqual(['cancel dose.old.1.a', 'add dose.new.3.c']);
    expect([...pending].sort()).toEqual(['dose.keep.2.b', 'dose.new.3.c', 'queue.x']);
  });

  it('a second pass with the same plan does nothing', async () => {
    const { port, calls } = fakePort();
    await syncReminders(port, [sr('dose.a.1.x')]);
    calls.length = 0;
    await syncReminders(port, [sr('dose.a.1.x')]);
    expect(calls).toEqual([]);
  });

  it('keeps going when one call fails, and retries it next pass', async () => {
    const { port, pending } = fakePort();
    let fail = true;
    const flaky: ReminderPort = {
      ...port,
      schedule: async (r) => {
        if (r.id === 'dose.bad.1.x' && fail) throw new Error('boom');
        return port.schedule(r);
      },
    };
    const plan = [sr('dose.bad.1.x'), sr('dose.ok.2.y')];
    expect((await syncReminders(flaky, plan)).scheduled).toBe(1);
    fail = false;
    await syncReminders(flaky, plan);
    expect([...pending].sort()).toEqual(['dose.bad.1.x', 'dose.ok.2.y']);
  });

  it('cancelAllDoseReminders removes only dose reminders', async () => {
    const { port, pending } = fakePort(['dose.a.1.x', 'queue.q']);
    await cancelAllDoseReminders(port);
    expect([...pending]).toEqual(['queue.q']);
  });
});

describe('plan → scheduled', () => {
  const NOW = at(2026, 11, 16, 9);

  it('a changed text (private switched on) gets a different id, so the old reminder is replaced', () => {
    const open = planReminders([schedule({ times: ['20:00'] })], [], NOW, undefined, undefined, {
      profileName: () => 'Ali',
    });
    const priv = planReminders([schedule({ times: ['20:00'] })], [], NOW, undefined, undefined, {
      isPrivate: () => true,
      profileName: () => 'Ali',
    });
    const a = toScheduled(open, (r) => buildReminderContent(r))[0];
    const b = toScheduled(priv, (r) => buildReminderContent(r))[0];
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith(`${open[0].id}.`)).toBe(true);
    expect(diffReminders([b.id], [a.id])).toEqual({ cancel: [a.id], add: [b.id] });
  });

  it('the notification data carries routing hints only', () => {
    const [r] = planReminders([schedule({ times: ['20:00'] })], [], NOW);
    const s = toScheduled([r], (x) => buildReminderContent(x))[0];
    expect(s.data).toEqual({ space: 'patient', type: 'medication.dose', route: '/today', entityId: 's1' });
    expect(JSON.stringify(s.data)).not.toContain('Amoxicillin');
  });

  it('hash and id are deterministic', () => {
    const c = { title: 'a', body: 'b' };
    expect(contentHash(c)).toBe(contentHash({ ...c }));
    expect(contentHash(c)).not.toBe(contentHash({ title: 'a', body: 'c' }));
    const [r] = planReminders([schedule({ times: ['20:00'] })], [], NOW);
    expect(notificationId(r, c)).toBe(notificationId(r, c));
  });
});

describe('runSerialised', () => {
  it('runs tasks one at a time, in order, even after a failure', async () => {
    const order: string[] = [];
    const slow = runSerialised(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push('a');
    });
    const bad = runSerialised(async () => {
      order.push('b');
      throw new Error('x');
    });
    const last = runSerialised(async () => {
      order.push('c');
    });
    await slow;
    await expect(bad).rejects.toThrow('x');
    await last;
    expect(order).toEqual(['a', 'b', 'c']);
  });
});
