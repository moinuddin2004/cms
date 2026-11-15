import type { PushData } from '@/core/notifications/push-data';
import type { Space } from '@/core/space/useSpaceStore';

import { createNotificationRouter } from './notification-router';

jest.mock('@/staff', () => ({
  handleStaffNotificationRoute: jest.fn(),
  isStaffSignedIn: jest.fn(),
}));

const data = (over: Partial<PushData> = {}): PushData => ({
  space: 'staff',
  type: 'queue.checked_in',
  route: '/queue/doctor',
  organizationId: 'o1',
  locationId: 'l1',
  entityId: null,
  ...over,
});

function setup(active: Space | null, staffSignedIn: boolean) {
  const deps = {
    getActiveSpace: jest.fn(() => active),
    switchSpace: jest.fn(),
    isStaffSignedIn: jest.fn(async () => staffSignedIn),
    handleStaff: jest.fn(),
  };
  return { deps, route: createNotificationRouter(deps) };
}

describe('notification router', () => {
  it('staff active and signed in: hands the tap to staff, no space change', async () => {
    const { deps, route } = setup('staff', true);
    await route(data());
    expect(deps.switchSpace).not.toHaveBeenCalled();
    expect(deps.handleStaff).toHaveBeenCalledWith(data());
  });

  it('another space showing, staff signed in: switches to staff then routes', async () => {
    const { deps, route } = setup('patient', true);
    await route(data());
    expect(deps.switchSpace).toHaveBeenCalledWith('staff');
    expect(deps.handleStaff).toHaveBeenCalledTimes(1);
  });

  it('welcome picker (no space), staff signed in: switches and routes', async () => {
    const { deps, route } = setup(null, true);
    await route(data());
    expect(deps.switchSpace).toHaveBeenCalledWith('staff');
    expect(deps.handleStaff).toHaveBeenCalledTimes(1);
  });

  it('staff not signed in: opens staff sign-in and drops the tap', async () => {
    const { deps, route } = setup('patient', false);
    await route(data());
    expect(deps.switchSpace).toHaveBeenCalledWith('staff');
    expect(deps.handleStaff).not.toHaveBeenCalled();
  });

  it('patient pushes are ignored until M3-07', async () => {
    const { deps, route } = setup('staff', true);
    await route(data({ space: 'patient' }));
    expect(deps.switchSpace).not.toHaveBeenCalled();
    expect(deps.handleStaff).not.toHaveBeenCalled();
  });
});
