import type { PushData } from '@/core/notifications/push-data';
import type { Organization } from '@/staff/store/useStaffAuthStore';

import { decidePushRoute, type PushRouteContext } from './push-route';

const ID = '3f2b8c1e-9d4a-4e6b-8a7c-1b2d3e4f5a6b';

const org = (id: string, locs: string[], signInBlock = null): Organization =>
  ({
    id,
    name: `Clinic ${id}`,
    locations: locs.map((l) => ({ id: l, name: `Loc ${l}` })),
    signInBlock,
  }) as unknown as Organization;

const ctx = (over: Partial<PushRouteContext> = {}): PushRouteContext => ({
  status: 'signedIn',
  organizations: [org('o1', ['l1', 'l2']), org('o2', ['l3'])],
  activeOrganizationId: 'o1',
  activeLocationId: 'l1',
  ...over,
});

const push = (over: Partial<PushData> = {}): PushData => ({
  space: 'staff',
  type: 'queue.checked_in',
  route: '/queue/doctor',
  organizationId: 'o1',
  locationId: 'l1',
  entityId: null,
  ...over,
});

describe('decidePushRoute — route map', () => {
  it.each([
    ['/queue/doctor', { pathname: '/queue', params: { segment: 'doctor' } }],
    ['/queue', { pathname: '/queue', params: { segment: 'board' } }],
    [`/patients/${ID}`, { pathname: `/patients/${ID}` }],
    [null, { pathname: '/today' }],
    ['/lab-orders/7', { pathname: '/today' }],
  ])('%s', (route, expected) => {
    expect(decidePushRoute(push({ route }), ctx())).toEqual({ kind: 'navigate', route: expected });
  });

  it('treats a push without clinic ids as the active place', () => {
    expect(decidePushRoute(push({ organizationId: null, locationId: null }), ctx()).kind).toBe(
      'navigate',
    );
  });
});

describe('decidePushRoute — session and location', () => {
  it('waits while the session restores or is unreachable', () => {
    expect(decidePushRoute(push(), ctx({ status: 'restoring' }))).toEqual({ kind: 'wait' });
    expect(decidePushRoute(push(), ctx({ status: 'unreachable' }))).toEqual({ kind: 'wait' });
    expect(decidePushRoute(push(), ctx({ activeLocationId: null }))).toEqual({ kind: 'wait' });
  });

  it('ignores a signed-out user and non-staff pushes', () => {
    expect(decidePushRoute(push(), ctx({ status: 'signedOut' }))).toEqual({ kind: 'ignore' });
    expect(decidePushRoute(push({ space: 'patient' }), ctx())).toEqual({ kind: 'ignore' });
  });

  it('asks before switching to another location of the same or another clinic', () => {
    expect(decidePushRoute(push({ locationId: 'l2' }), ctx())).toMatchObject({
      kind: 'switch',
      organizationId: 'o1',
      locationId: 'l2',
      locationName: 'Clinic o1 – Loc l2',
    });
    expect(decidePushRoute(push({ organizationId: 'o2', locationId: 'l3' }), ctx())).toMatchObject({
      kind: 'switch',
      organizationId: 'o2',
      locationId: 'l3',
    });
  });

  it('never switches to a place this user cannot open', () => {
    expect(decidePushRoute(push({ organizationId: 'o9', locationId: 'l9' }), ctx())).toEqual({
      kind: 'ignore',
    });
    expect(decidePushRoute(push({ locationId: 'nope' }), ctx())).toEqual({ kind: 'ignore' });
    const blocked = ctx({
      organizations: [org('o1', ['l1']), org('o2', ['l3'], { code: 'CLINIC_REJECTED' } as never)],
    });
    expect(decidePushRoute(push({ organizationId: 'o2', locationId: 'l3' }), blocked)).toEqual({
      kind: 'ignore',
    });
  });
});
