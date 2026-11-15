import { parseOfflineHint } from './offline-hint';
import { PERSIST_MAX_AGE } from './persist';

const NOW = 1_800_000_000_000;
const persisted = (over: object = {}) =>
  JSON.stringify({
    timestamp: NOW - 1000,
    buster: '1.2.3:user-1:org-1:loc-1',
    clientState: { mutations: [], queries: [{ queryKey: ['access', 'me'] }] },
    ...over,
  });

describe('parseOfflineHint', () => {
  it('reads the identity from the persisted client buster', () => {
    expect(parseOfflineHint(persisted(), '1.2.3', NOW)).toEqual({
      userId: 'user-1',
      orgId: 'org-1',
      locationId: 'loc-1',
    });
  });

  it.each([
    ['nothing saved', null],
    ['not JSON', '{oops'],
    ['another build', persisted({ buster: '1.2.2:user-1:org-1:loc-1' })],
    ['too old', persisted({ timestamp: NOW - PERSIST_MAX_AGE - 1 })],
    ['no queries saved', persisted({ clientState: { queries: [] } })],
    ['incomplete identity', persisted({ buster: '1.2.3:user-1:org-1:' })],
    ['extra parts', persisted({ buster: '1.2.3:a:b:c:d' })],
    ['no buster', persisted({ buster: undefined })],
  ])('returns null: %s', (_name, raw) => {
    expect(parseOfflineHint(raw, '1.2.3', NOW)).toBeNull();
  });
});
