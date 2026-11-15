import * as SecureStore from 'expo-secure-store';

import { REFRESH_TOKEN_KEYS } from '@/core/space/session-keys';
import { useSpaceStore } from '@/core/space/useSpaceStore';
import { switchSpace } from '@/core/space/switch-space';
import { openSecureCache } from '@/core/storage/secure-cache';
import { patientQueryClient, signOutPatient } from '@/patient';
import { staffQueryClient } from '@/staff';

// The layout needs the router + native runtime, which Jest cannot load; only sign-out is under test.
jest.mock('@/patient/navigation/PatientLayout', () => ({ PatientLayout: () => null }));
jest.mock('@/patient/features/auth/api/auth.api', () => ({ logout: jest.fn(async () => undefined) }));

const KEY_STAFF = '0123456789abcdef0123456789abcdef';
const KEY_PATIENT = 'fedcba9876543210fedcba9876543210';

/**
 * Acceptance of M2-06: both spaces can be signed in at once, and signing out of
 * the patient space wipes ONLY patient data (docs/03 §7).
 */
describe('space isolation on sign-out', () => {
  beforeEach(async () => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEYS.staff, 'staff-session:tok');
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEYS.patient, 'patient-session:tok');
    await SecureStore.setItemAsync('staff.cacheKey', KEY_STAFF);
    await SecureStore.setItemAsync('patient.cacheKey', KEY_PATIENT);
    (await openSecureCache('staff')).set('probe', 'staff-data');
    (await openSecureCache('patient')).set('probe', 'patient-data');
    staffQueryClient.setQueryData(['access', 'me'], { staff: true });
    patientQueryClient.setQueryData(['links'], { patient: true });
    switchSpace('patient');
  });

  it('wipes the patient cache, key, token and queries, and leaves staff untouched', async () => {
    await signOutPatient(patientQueryClient);

    // patient gone
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEYS.patient)).toBeNull();
    expect(await SecureStore.getItemAsync('patient.cacheKey')).toBeNull();
    expect(patientQueryClient.getQueryData(['links'])).toBeUndefined();
    await SecureStore.setItemAsync('patient.cacheKey', KEY_PATIENT);
    expect((await openSecureCache('patient')).getString('probe')).toBeUndefined();

    // staff intact
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEYS.staff)).toBe('staff-session:tok');
    expect(await SecureStore.getItemAsync('staff.cacheKey')).toBe(KEY_STAFF);
    expect((await openSecureCache('staff')).getString('probe')).toBe('staff-data');
    expect(staffQueryClient.getQueryData(['access', 'me'])).toEqual({ staff: true });
  });

  it('lands in the staff space because it is still signed in', async () => {
    await signOutPatient(patientQueryClient);
    expect(useSpaceStore.getState().activeSpace).toBe('staff');
  });

  it('lands on the welcome picker when staff has no session', async () => {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEYS.staff);
    await signOutPatient(patientQueryClient);
    expect(useSpaceStore.getState().activeSpace).toBeNull();
  });

  it('switching spaces never signs either one out', async () => {
    switchSpace('staff');
    switchSpace('patient');
    switchSpace('staff');
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEYS.staff)).toBe('staff-session:tok');
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEYS.patient)).toBe('patient-session:tok');
  });
});
