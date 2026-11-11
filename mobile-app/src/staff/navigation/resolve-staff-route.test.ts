import { resolveStaffRoute } from './resolve-staff-route';

describe('resolveStaffRoute', () => {
  const base = { mustSelectLocation: false, clinicBlocked: false };

  it('sends an unreachable session to the offline page', () => {
    expect(resolveStaffRoute({ ...base, status: 'unreachable' })).toBe('offline');
  });

  it('keeps the offline page even when a selection would be needed afterwards', () => {
    expect(
      resolveStaffRoute({
        status: 'unreachable',
        mustSelectLocation: true,
        clinicBlocked: true,
      }),
    ).toBe('offline');
  });

  it('sends a signed-out session to login', () => {
    expect(resolveStaffRoute({ ...base, status: 'signedOut' })).toBe('login');
  });

  it('shows login while the session restores (the splash covers it)', () => {
    expect(resolveStaffRoute({ ...base, status: 'restoring' })).toBe('login');
  });

  it('sends a signed-in session without a location to select-location', () => {
    expect(
      resolveStaffRoute({ status: 'signedIn', mustSelectLocation: true, clinicBlocked: false }),
    ).toBe('select-location');
  });

  it('sends a signed-in session in a blocked clinic to select-location', () => {
    expect(
      resolveStaffRoute({ status: 'signedIn', mustSelectLocation: false, clinicBlocked: true }),
    ).toBe('select-location');
  });

  it('sends a signed-in session with a location to main', () => {
    expect(resolveStaffRoute({ ...base, status: 'signedIn' })).toBe('main');
  });
});
