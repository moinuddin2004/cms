import * as SecureStore from 'expo-secure-store';

import { getPref } from '@/core/storage/prefs';

import { REFRESH_TOKEN_KEYS } from './session-keys';
import { hasSavedSession, leaveSpaceAfterSignOut, otherSpace, switchSpace } from './switch-space';
import { useSpaceStore } from './useSpaceStore';

const active = () => useSpaceStore.getState().activeSpace;

describe('space switching', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEYS.staff);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEYS.patient);
    switchSpace(null);
  });

  it('switches both ways without touching either session', async () => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEYS.staff, 's:1');
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEYS.patient, 'p:1');

    switchSpace('patient');
    expect(active()).toBe('patient');
    expect(getPref('space.active')).toBe('patient');
    switchSpace('staff');
    expect(active()).toBe('staff');

    expect(await hasSavedSession('staff')).toBe(true);
    expect(await hasSavedSession('patient')).toBe(true);
  });

  it('otherSpace flips', () => {
    expect(otherSpace('staff')).toBe('patient');
    expect(otherSpace('patient')).toBe('staff');
  });

  it('signing out of patient goes to staff when staff has a saved session', async () => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEYS.staff, 's:1');
    switchSpace('patient');
    await leaveSpaceAfterSignOut('patient');
    expect(active()).toBe('staff');
  });

  it('signing out of staff goes to patient when patient has a saved session', async () => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEYS.patient, 'p:1');
    switchSpace('staff');
    await leaveSpaceAfterSignOut('staff');
    expect(active()).toBe('patient');
  });

  it('signing out of the only signed-in space goes to the welcome picker', async () => {
    switchSpace('patient');
    await leaveSpaceAfterSignOut('patient');
    expect(active()).toBeNull();
    expect(getPref('space.active')).toBeUndefined();
  });
});
