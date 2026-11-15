import { QueryClient } from '@tanstack/react-query';
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { beginPatientSignOut, endPatientSignOut, refreshSession } from '@/patient/lib/api';
import { getRefreshToken, setRefreshToken } from '@/patient/lib/session';
import { usePatientAuthStore, type PatientSessionPayload } from '@/patient/store/usePatientAuthStore';

import { signOutPatient } from './sign-out';

jest.mock('../api/auth.api', () => ({ logout: jest.fn(async () => undefined) }));
jest.mock('@/patient/lib/persist-cache', () => ({ wipePatientPersistedCache: jest.fn() }));

function session(n: number): PatientSessionPayload {
  return {
    account: { id: 'acc-1', fullName: 'Ali', email: 'ali@example.com' },
    accessToken: `access-${n}`,
    refreshToken: `session:token-${n}`,
    isNewAccount: false,
    needsName: false,
  };
}

function response(data: unknown): AxiosResponse {
  return { data: { data }, status: 200, statusText: 'OK', headers: {}, config: {} as InternalAxiosRequestConfig };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('patient sign-out vs a refresh in flight', () => {
  beforeEach(async () => {
    usePatientAuthStore.getState().setSession(session(1));
    await setRefreshToken('session:token-1');
  });

  afterEach(() => jest.restoreAllMocks());

  it('refresh in flight → sign-out → refresh resolves: still signed out, nothing stored, new token revoked', async () => {
    let resolveRefresh!: (r: AxiosResponse) => void;
    const post = jest
      .spyOn(axios, 'post')
      .mockImplementationOnce(() => new Promise<AxiosResponse>((resolve) => (resolveRefresh = resolve)))
      .mockResolvedValue(response({ ok: true }));

    const refresh = refreshSession();
    await tick();
    let done = false;
    const out = signOutPatient(new QueryClient()).then(() => {
      done = true;
    });
    await tick();
    expect(done).toBe(false); // sign-out waits for the refresh in flight

    resolveRefresh(response(session(2)));
    await out;

    await expect(refresh).resolves.toBeNull();
    expect(await getRefreshToken()).toBeNull();
    const state = usePatientAuthStore.getState();
    expect(state.status).toBe('signedOut');
    expect(state.accessToken).toBeNull();
    // the freshly rotated token was revoked on the server
    const [url, , options] = post.mock.calls[1];
    expect(String(url)).toMatch(/\/patient-auth\/logout$/);
    expect(options?.headers).toMatchObject({ 'x-patient-refresh-token': 'session:token-2' });
  });

  it('a refresh that starts between begin and end of sign-out is discarded too', async () => {
    jest
      .spyOn(axios, 'post')
      .mockResolvedValueOnce(response(session(2)))
      .mockResolvedValue(response({ ok: true }));
    await beginPatientSignOut();
    await expect(refreshSession()).resolves.toBeNull();
    endPatientSignOut();
    expect(await getRefreshToken()).toBe('session:token-1'); // nothing written back
  });

  it('refreshing again after the sign-out works normally', async () => {
    jest.spyOn(axios, 'post').mockResolvedValueOnce(response(session(2)));
    await beginPatientSignOut();
    endPatientSignOut();
    await expect(refreshSession()).resolves.toMatchObject({ accessToken: 'access-2' });
    expect(await getRefreshToken()).toBe('session:token-2');
  });
});
