import { translate } from '@/core/i18n';

import type { ActiveQueueEntry } from '../types/queue.types';
import { aheadText, cardLine } from './queue-text';

const t = (key: Parameters<typeof translate>[0], params?: Parameters<typeof translate>[1]) =>
  translate(key, params);

const entry = (over: Partial<ActiveQueueEntry> = {}): ActiveQueueEntry => ({
  entryId: 'e1',
  profileId: 'p1',
  clinic: {} as never,
  location: { id: 'l1', name: 'Main', timezone: 'Asia/Karachi' },
  token: 'A-012',
  status: 'waiting',
  doctorName: 'Dr Sana',
  peopleAhead: 3,
  nowServingToken: 'A-009',
  serviceDate: '2026-11-16',
  ...over,
});

describe('queue text', () => {
  it('summarises the token, people ahead and doctor on one line', () => {
    expect(cardLine(t, entry())).toBe('Token A-012 · 3 ahead · Dr Sana');
    expect(cardLine(t, entry({ peopleAhead: 0 }))).toBe("Token A-012 · You're next · Dr Sana");
    expect(cardLine(t, entry({ status: 'called', peopleAhead: 0, doctorName: null }))).toBe(
      'Token A-012 · Your turn',
    );
  });

  it('plural forms of the full sentence', () => {
    expect(aheadText(t, entry({ peopleAhead: 1 }))).toBe('1 person ahead of you');
    expect(aheadText(t, entry({ peopleAhead: 4 }))).toBe('4 people ahead of you');
    expect(aheadText(t, entry({ peopleAhead: null }))).toBeNull();
    expect(aheadText(t, entry({ status: 'called' }))).toBeNull();
  });
});
