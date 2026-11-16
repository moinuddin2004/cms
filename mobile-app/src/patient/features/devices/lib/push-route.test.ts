import type { PushData } from '@/core/notifications/push-data';

import { hrefOf, resolvePatientPushRoute } from './push-route';

const ID = '3f1c2a9e-8b4d-4c1a-9a55-0d6f1c2b7e10';
const data = (over: Partial<PushData> = {}): PushData => ({
  space: 'patient',
  type: 'queue.turn_near',
  route: `/visit/${ID}`,
  organizationId: 'o1',
  locationId: 'l1',
  entityId: ID,
  ...over,
});

describe('resolvePatientPushRoute', () => {
  it('opens the visit screen for a visit route', () => {
    expect(resolvePatientPushRoute(data())).toEqual({ kind: 'visit', entryId: ID });
    expect(hrefOf({ kind: 'visit', entryId: ID })).toBe(`/visit/${ID}`);
  });

  it('opens the appointment for a reminder', () => {
    const r = resolvePatientPushRoute(
      data({ type: 'appointment.reminder', route: `/appointments/${ID}` }),
    );
    expect(r).toEqual({ kind: 'appointment', id: ID });
    expect(hrefOf(r!)).toBe(`/appointments/${ID}`);
  });

  it('falls back to the entry id for a queue push without a route', () => {
    expect(resolvePatientPushRoute(data({ route: null }))).toEqual({ kind: 'visit', entryId: ID });
  });

  it('ignores staff pushes and anything that is not one of our shapes', () => {
    expect(resolvePatientPushRoute(data({ space: 'staff' }))).toBeNull();
    for (const route of ['/queue/doctor', '/visit/../../x', '/visit/a b', '//evil', '/visit/']) {
      expect(resolvePatientPushRoute(data({ route, type: 'other', entityId: null }))).toBeNull();
    }
  });
});
