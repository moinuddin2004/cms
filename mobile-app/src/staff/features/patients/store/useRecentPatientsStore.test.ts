import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { RECENT_PATIENTS_MAX, useRecentPatientsStore } from './useRecentPatientsStore';

const ids = () => useRecentPatientsStore.getState().ids;
const push = (id: string) => useRecentPatientsStore.getState().push(id);

beforeEach(() => {
  useStaffAuthStore.setState({
    status: 'signedIn',
    activeOrganizationId: 'o1',
    activeLocationId: 'l1',
  });
  useRecentPatientsStore.getState().clear();
});

describe('useRecentPatientsStore', () => {
  it('puts the newest first and moves a repeat to the front', () => {
    push('a');
    push('b');
    push('c');
    push('a');
    expect(ids()).toEqual(['a', 'c', 'b']);
  });

  it('keeps only the last 10', () => {
    for (let i = 0; i < 15; i++) push(`p${i}`);
    expect(ids()).toHaveLength(RECENT_PATIENTS_MAX);
    expect(ids()[0]).toBe('p14');
    expect(ids()[9]).toBe('p5');
  });

  it('clears on sign-out', () => {
    push('a');
    useStaffAuthStore.getState().clearAuth();
    expect(ids()).toEqual([]);
  });

  it('clears on location switch and on clinic switch, not on unrelated updates', () => {
    push('a');
    useStaffAuthStore.setState({ emailVerificationRequired: true });
    expect(ids()).toEqual(['a']);
    useStaffAuthStore.getState().setLocationContext('o1', 'l2');
    expect(ids()).toEqual([]);
    push('b');
    useStaffAuthStore.getState().setLocationContext('o2', 'l2');
    expect(ids()).toEqual([]);
  });

  it('does not touch the store while signed out and already empty', () => {
    useStaffAuthStore.getState().clearAuth();
    const before = ids();
    useStaffAuthStore.setState({ emailVerificationRequired: true });
    useStaffAuthStore.getState().clearAuth();
    expect(ids()).toBe(before);
  });
});
