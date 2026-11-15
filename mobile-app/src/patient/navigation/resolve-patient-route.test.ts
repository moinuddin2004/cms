import { resolvePatientRoute, type PatientRouteState } from './resolve-patient-route';

const base: PatientRouteState = { status: 'signedOut', awaitingCode: false, needsName: false };

describe('resolvePatientRoute (docs/02 §4)', () => {
  it.each([
    [{ status: 'unreachable' }, 'offline'],
    [{ status: 'unreachable', awaitingCode: true, needsName: true }, 'offline'],
    [{ status: 'restoring' }, 'sign-in'],
    [{ status: 'signedOut' }, 'sign-in'],
    [{ status: 'signedOut', awaitingCode: true }, 'verify-code'],
    [{ status: 'signedIn', needsName: true }, 'name'],
    [{ status: 'signedIn' }, 'main'],
    // a stale pending email never blocks a signed-in session
    [{ status: 'signedIn', awaitingCode: true }, 'main'],
  ] as [Partial<PatientRouteState>, string][])('%j → %s', (state, route) => {
    expect(resolvePatientRoute({ ...base, ...state })).toBe(route);
  });
});
